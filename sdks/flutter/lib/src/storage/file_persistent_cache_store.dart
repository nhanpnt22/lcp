import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as p;

import '../entry/cache_entry.dart';
import '../key/h57_key_validation.dart';
import 'persistent_cache_store.dart';

typedef FileJsonEncoderFn<T> = Object? Function(T value);
typedef FileJsonDecoderFn<T> = T Function(Object? jsonValue);

/// Persists cache entries as JSON files under [rootDir].
///
/// Each entry is stored as `<rootDir>/<H57 cache_key>.json`. Not supported
/// on web (dart:io is unavailable there); use [SqlitePersistentCacheStore]
/// for cross-platform persistence.
class FilePersistentCacheStore<T> implements PersistentCacheStore<T> {
  FilePersistentCacheStore({
    required FileJsonEncoderFn<T> toJson,
    required FileJsonDecoderFn<T> fromJson,
    required Future<String> Function() rootDirResolver,
    DateTime Function()? now,
  })  : _toJson = toJson,
        _fromJson = fromJson,
        _rootDirResolver = rootDirResolver,
        _now = now ?? DateTime.now;

  final FileJsonEncoderFn<T> _toJson;
  final FileJsonDecoderFn<T> _fromJson;
  final Future<String> Function() _rootDirResolver;
  final DateTime Function() _now;

  Future<Directory> _dir() async {
    final dir = Directory(await _rootDirResolver());
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  File _fileFor(Directory dir, String normalizedKey) {
    return File(p.join(dir.path, '$normalizedKey.json'));
  }

  @override
  Future<CacheEntry<T>?> get(String cacheKey) async {
    final normalizedKey = assertH57CacheKey(cacheKey, 'file.get');
    final dir = await _dir();
    final file = _fileFor(dir, normalizedKey);
    if (!await file.exists()) {
      return null;
    }

    final entry = _decodeEntry(await file.readAsString());
    if (entry == null || entry.cacheKey != normalizedKey) {
      return null;
    }

    if (entry.metadata.expiresAt <= _now().millisecondsSinceEpoch) {
      await _deleteFile(file);
      return null;
    }
    return entry;
  }

  @override
  Future<void> set(CacheEntry<T> entry) async {
    final normalizedKey = assertH57CacheKey(entry.cacheKey, 'file.set');
    final dir = await _dir();
    final file = _fileFor(dir, normalizedKey);
    final tmpFile = File('${file.path}.tmp');
    final payload = _encodeEntry(
      CacheEntry<T>(
        cacheKey: normalizedKey,
        data: entry.data,
        metadata: entry.metadata,
      ),
    );
    await tmpFile.writeAsString(payload);
    await tmpFile.rename(file.path);
  }

  @override
  Future<void> delete(String cacheKey) async {
    final normalizedKey = assertH57CacheKey(cacheKey, 'file.delete');
    final dir = await _dir();
    await _deleteFile(_fileFor(dir, normalizedKey));
  }

  @override
  Future<void> clear() async {
    final dir = await _dir();
    for (final entity in await dir.list().toList()) {
      if (entity is File && entity.path.endsWith('.json')) {
        await _deleteFile(entity);
      }
    }
  }

  @override
  Future<int> pruneExpired({required int now}) async {
    final dir = await _dir();
    var removed = 0;
    for (final entity in await dir.list().toList()) {
      if (entity is! File || !entity.path.endsWith('.json')) {
        continue;
      }
      final entry = _decodeEntry(await entity.readAsString());
      if (entry == null) {
        continue;
      }
      if (entry.metadata.expiresAt <= now) {
        await _deleteFile(entity);
        removed++;
      }
    }
    return removed;
  }

  @override
  Future<List<CacheEntry<T>>> hydrateAllValid({
    required int now,
    int? limit,
  }) async {
    final dir = await _dir();
    final files = (await dir.list().toList())
        .whereType<File>()
        .where((file) => file.path.endsWith('.json'))
        .toList()
      ..sort((a, b) => a.path.compareTo(b.path));

    final entries = <CacheEntry<T>>[];
    for (final file in files) {
      final entry = _decodeEntry(await file.readAsString());
      if (entry == null || entry.metadata.expiresAt <= now) {
        continue;
      }
      entries.add(entry);
      if (limit != null && entries.length >= limit) {
        break;
      }
    }
    return entries;
  }

  Future<void> _deleteFile(File file) async {
    if (await file.exists()) {
      await file.delete();
    }
  }

  String _encodeEntry(CacheEntry<T> entry) {
    return jsonEncode({
      'cache_key': entry.cacheKey,
      'data': _toJson(entry.data),
      'metadata': entry.metadata.toJson(),
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

      if (!isH57CacheKey(key)) {
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
