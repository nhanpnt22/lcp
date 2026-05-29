import 'dart:convert';

import 'package:path/path.dart' as p;
import 'package:sqflite_common/sqlite_api.dart';

import '../entry/cache_entry.dart';
import 'persistent_cache_store.dart';

typedef JsonEncoderFn<T> = Object? Function(T value);
typedef JsonDecoderFn<T> = T Function(Object? jsonValue);

class SqlitePersistentCacheStore<T> implements PersistentCacheStore<T> {
  SqlitePersistentCacheStore({
    required JsonEncoderFn<T> toJson,
    required JsonDecoderFn<T> fromJson,
    required DatabaseFactory databaseFactory,
    required Future<String> Function() databasePathResolver,
    DateTime Function()? now,
    String dbName = 'lcp_cache.db',
    String tableName = 'lcp_entries',
  })  : _toJson = toJson,
        _fromJson = fromJson,
        _now = now ?? DateTime.now,
        _databaseFactory = databaseFactory,
        _databasePathResolver = databasePathResolver,
        _dbName = dbName,
        _tableName = tableName;

  final JsonEncoderFn<T> _toJson;
  final JsonDecoderFn<T> _fromJson;
  final DateTime Function() _now;
  final DatabaseFactory _databaseFactory;
  final Future<String> Function() _databasePathResolver;
  final String _dbName;
  final String _tableName;

  Future<Database>? _dbFuture;

  Future<Database> _db() {
    final dbFuture = _dbFuture ??= _openDb();
    return dbFuture;
  }

  Future<Database> _openDb() async {
    final factory = _databaseFactory;
    final basePath = await _databasePathResolver();
    final path = p.join(basePath, _dbName);
    return factory.openDatabase(
      path,
      options: OpenDatabaseOptions(
        version: 1,
        onCreate: (db, _) async {
          await db.execute('''
CREATE TABLE $_tableName (
  cache_key TEXT PRIMARY KEY,
  entry_json TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
)
''');
          await db.execute(
            'CREATE INDEX idx_${_tableName}_expires_at ON $_tableName(expires_at)',
          );
        },
      ),
    );
  }

  @override
  Future<CacheEntry<T>?> get(String key) async {
    final db = await _db();
    final rows = await db.query(
      _tableName,
      columns: const ['entry_json', 'expires_at'],
      where: 'cache_key = ?',
      whereArgs: [key],
      limit: 1,
    );
    if (rows.isEmpty) {
      return null;
    }

    final row = rows.first;
    final expiresAtMs = row['expires_at'] as int;
    if (expiresAtMs <= _now().millisecondsSinceEpoch) {
      await db.delete(_tableName, where: 'cache_key = ?', whereArgs: [key]);
      return null;
    }

    final jsonString = row['entry_json'] as String;
    final entry = _decodeEntry(jsonString);
    if (entry == null) {
      await db.delete(_tableName, where: 'cache_key = ?', whereArgs: [key]);
      return null;
    }
    return entry;
  }

  @override
  Future<void> set(CacheEntry<T> entry) async {
    final db = await _db();
    final values = _encodeRow(entry);
    await db.insert(_tableName, values, conflictAlgorithm: ConflictAlgorithm.replace);
  }

  @override
  Future<void> delete(String key) async {
    final db = await _db();
    await db.delete(_tableName, where: 'cache_key = ?', whereArgs: [key]);
  }

  @override
  Future<void> clear() async {
    final db = await _db();
    await db.delete(_tableName);
  }

  @override
  Future<int> pruneExpired({required int now}) async {
    final db = await _db();
    return db.delete(_tableName, where: 'expires_at <= ?', whereArgs: [now]);
  }

  @override
  Future<List<CacheEntry<T>>> hydrateAllValid({required int now, int? limit}) async {
    final db = await _db();
    final rows = await db.query(
      _tableName,
      columns: const ['entry_json'],
      where: 'expires_at > ?',
      whereArgs: [now],
      orderBy: 'updated_at DESC',
      limit: limit,
    );

    final entries = <CacheEntry<T>>[];
    for (final row in rows) {
      final jsonString = row['entry_json'] as String;
      final entry = _decodeEntry(jsonString);
      if (entry != null) {
        entries.add(entry);
      }
    }
    return entries;
  }

  Future<void> close() async {
    final dbFuture = _dbFuture;
    _dbFuture = null;
    if (dbFuture != null) {
      final db = await dbFuture;
      await db.close();
    }
  }

  Map<String, Object?> _encodeRow(CacheEntry<T> entry) {
    final payload = _encodeEntry(entry);
    return {
      'cache_key': entry.cacheKey,
      'entry_json': payload,
      'expires_at': entry.metadata.expiresAt,
      'updated_at': entry.metadata.createdAt,
    };
  }

  String _encodeEntry(CacheEntry<T> entry) {
    return jsonEncode({
      'cache_key': entry.cacheKey,
      'data': _toJson(entry.data),
      'metadata': {
        'source': entry.metadata.source == CacheSource.api ? 'API' : 'CACHE',
        'created_at': entry.metadata.createdAt,
        'expires_at': entry.metadata.expiresAt,
        'ttl_ms': entry.metadata.ttlMs,
        'schema_version': entry.metadata.schemaVersion,
        'data_version': entry.metadata.dataVersion,
        'spec_checksum': entry.metadata.specChecksum,
        'cache_namespace': entry.metadata.cacheNamespace,
        'compressed': entry.metadata.compressed,
      },
    });
  }

  CacheEntry<T>? _decodeEntry(String jsonString) {
    try {
      final decoded = jsonDecode(jsonString);
      if (decoded is! Map<String, Object?>) {
        return null;
      }
      final metadataMap = decoded['metadata'];
      if (metadataMap is! Map<String, Object?>) {
        return null;
      }

      final sourceName = metadataMap['source'];
      final source = sourceName == 'API' ? CacheSource.api : CacheSource.cache;

      final data = _fromJson(decoded['data']);
      final key = decoded['cache_key'];
      final createdAt = metadataMap['created_at'];
      final expiresAt = metadataMap['expires_at'];
      final ttlMs = metadataMap['ttl_ms'];
      final schemaVersion = metadataMap['schema_version'];
      final dataVersion = metadataMap['data_version'];
      final specChecksum = metadataMap['spec_checksum'];
      final cacheNamespace = metadataMap['cache_namespace'];
      final compressed = metadataMap['compressed'];

      if (key is! String ||
          createdAt is! int ||
          expiresAt is! int ||
          ttlMs is! int ||
          schemaVersion is! String ||
          dataVersion is! String ||
          specChecksum is! String ||
          cacheNamespace is! String ||
          compressed is! bool) {
        return null;
      }

      return CacheEntry<T>(
        cacheKey: key,
        data: data,
        metadata: CacheMetadata(
          source: source,
          createdAt: createdAt,
          expiresAt: expiresAt,
          ttlMs: ttlMs,
          schemaVersion: schemaVersion,
          dataVersion: dataVersion,
          specChecksum: specChecksum,
          cacheNamespace: cacheNamespace,
          compressed: compressed,
        ),
      );
    } catch (_) {
      return null;
    }
  }
}