import 'dart:convert';
import 'dart:io';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:test/test.dart';

void main() {
  sqfliteFfiInit();

  final datasetsPath = Platform.environment['LCP_CROSS_DATASETS_FILE'];
  final sqlitePath = Platform.environment['LCP_CROSS_FLUTTER_SQLITE_DB'];
  final evidencePath = Platform.environment['LCP_CROSS_FLUTTER_EVIDENCE_FILE'];
  final datasetCount = int.tryParse(
        Platform.environment['LCP_CROSS_DATASET_COUNT'] ?? '100',
      ) ??
      100;
  final enabled =
      datasetsPath != null && sqlitePath != null && evidencePath != null;

  test('cross-sdk sqlite evidence', skip: !enabled, () async {
    final datasetsFile = File(datasetsPath!);
    final sqliteFile = File(sqlitePath!);
    final evidenceFile = File(evidencePath!);

    final datasetsRaw = await datasetsFile.readAsString();
    final decoded = jsonDecode(datasetsRaw);
    if (decoded is! List) {
      fail('datasets JSON must be an array');
    }
    if (decoded.length != datasetCount) {
      fail('expected $datasetCount datasets, got ${decoded.length}');
    }

    if (await sqliteFile.exists()) {
      await sqliteFile.delete();
    }
    await sqliteFile.parent.create(recursive: true);

    final store = SqlitePersistentCacheStore<Map<String, Object?>>(
      toJson: (value) => value,
      fromJson: (json) => Map<String, Object?>.from(json as Map),
      now: () => DateTime.fromMillisecondsSinceEpoch(1700000000000),
      databaseFactory: databaseFactoryFfi,
      databasePathResolver: () async => sqliteFile.parent.path,
      dbName: sqliteFile.uri.pathSegments.last,
    );

    final records = <Map<String, Object?>>[];

    for (var i = 0; i < decoded.length; i++) {
      final row = decoded[i];
      if (row is! Map) {
        fail('dataset at index $i must be an object');
      }
      final ds = Map<String, Object?>.from(row.cast<String, Object?>());

      final cacheKey = computeCacheKey(
        CacheKeyInput(
          namespace: ds['namespace'] as String,
          operationId: ds['operation_id'] as String,
          payload: ds['payload'],
          schemaVersion: ds['schema_version'] as String,
          specChecksum: ds['spec_checksum'] as String,
          userScope: ds['user_scope'] as String,
        ),
        h57HashFn,
      );

      final value = ds['value'] as String;

      await store.set(
        CacheEntry<Map<String, Object?>>(
          cacheKey: cacheKey,
          data: {'value': value},
          metadata: createCacheMetadata(
            source: CacheSource.api,
            createdAt: 1700000000000,
            ttlMs: 60000,
            schemaVersion: ds['schema_version'] as String,
            dataVersion: 'dv-1',
            specChecksum: ds['spec_checksum'] as String,
            cacheNamespace: ds['namespace'] as String,
          ),
        ),
      );

      final recomputed = computeCacheKey(
        CacheKeyInput(
          namespace: ds['namespace'] as String,
          operationId: ds['operation_id'] as String,
          payload: ds['payload'],
          schemaVersion: ds['schema_version'] as String,
          specChecksum: ds['spec_checksum'] as String,
          userScope: ds['user_scope'] as String,
        ),
        h57HashFn,
      );

      records.add({
        'dataset_index': i,
        'cache_key': cacheKey,
        'value': value,
        'h57_match': recomputed == cacheKey,
      });
    }

    final db = await databaseFactoryFfi.openDatabase(sqlitePath);
    final rows = await db.query(
      'lcp_entries',
      columns: const ['cache_key', 'entry_json'],
      orderBy: 'cache_key ASC',
    );

    expect(rows.length, equals(datasetCount));

    final dbByKey = <String, Map<String, Object?>>{};
    for (final row in rows) {
      final cacheKey = row['cache_key'] as String;
      final entry = jsonDecode(row['entry_json'] as String);
      if (entry is! Map) {
        fail('entry_json for $cacheKey is not an object');
      }
      final entryMap = Map<String, Object?>.from(entry.cast<String, Object?>());
      dbByKey[cacheKey] = entryMap;
    }

    for (final record in records) {
      final cacheKey = record['cache_key'] as String;
      final entry = dbByKey[cacheKey];
      if (entry == null) {
        fail('missing sqlite row for cache_key $cacheKey');
      }
      final data = entry['data'];
      if (data is! Map) {
        fail('data object missing for cache_key $cacheKey');
      }
      final dataMap = Map<String, Object?>.from(data.cast<String, Object?>());
      record['db_cache_key'] = entry['cache_key'] as String;
      record['db_value'] = dataMap['value'] as String;
      expect(record['db_value'], equals(record['value']));
    }

    await db.close();
    await store.close();

    records.sort((a, b) =>
        (a['dataset_index'] as int).compareTo(b['dataset_index'] as int));

    final out = {
      'sdk': 'flutter',
      'db_path': sqlitePath,
      'records': records,
      'row_count': rows.length,
    };

    await evidenceFile.parent.create(recursive: true);
    await evidenceFile.writeAsString(
      const JsonEncoder.withIndent('  ').convert(out),
    );
  });
}
