import 'dart:io';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

const n = 10000;

String h57Key(String label) {
  return computeCacheKey(
    CacheKeyInput(
      namespace: 'bench',
      operationId: label,
      payload: {'label': label},
      schemaVersion: 'v1',
      specChecksum: 'spec-v1',
      userScope: 'bench-user',
    ),
    h57HashFn,
  );
}

CacheEntry<Map<String, Object?>> benchEntry(String key, int i) {
  return CacheEntry<Map<String, Object?>>(
    cacheKey: key,
    data: {'value': 'payload-$i', 'i': i},
    metadata: createCacheMetadata(
      source: CacheSource.api,
      createdAt: 1000,
      ttlMs: 86400000,
      schemaVersion: 'v1',
      dataVersion: 'v1',
      specChecksum: 'spec',
      cacheNamespace: 'ns',
    ),
  );
}

Future<void> bench(
  String name,
  PersistentCacheStore<Map<String, Object?>> store,
  List<String> keys,
  List<CacheEntry<Map<String, Object?>>> entries,
) async {
  final writeStart = DateTime.now();
  for (final entry in entries) {
    await store.set(entry);
  }
  final writeMs = DateTime.now().difference(writeStart).inMicroseconds / 1000;

  final readStart = DateTime.now();
  for (final key in keys) {
    await store.get(key);
  }
  final readMs = DateTime.now().difference(readStart).inMicroseconds / 1000;

  final perWrite = (writeMs / entries.length).toStringAsFixed(4);
  final perRead = (readMs / keys.length).toStringAsFixed(4);
  print(
    '$name: write ${entries.length} entries in ${writeMs.toStringAsFixed(1)}ms '
    '(${perWrite}ms/op), read ${keys.length} entries in ${readMs.toStringAsFixed(1)}ms '
    '(${perRead}ms/op)',
  );
}

Future<void> main() async {
  sqfliteFfiInit();

  final keys = List.generate(n, (i) => h57Key('key-$i'));
  final entries = List.generate(n, (i) => benchEntry(keys[i], i));

  final fileDir = await Directory.systemTemp.createTemp('lcp_bench_file_');
  final sqliteDir = await Directory.systemTemp.createTemp('lcp_bench_sqlite_');

  try {
    final fileStore = FilePersistentCacheStore<Map<String, Object?>>(
      toJson: (value) => value,
      fromJson: (json) => Map<String, Object?>.from(json as Map),
      rootDirResolver: () async => fileDir.path,
    );
    await bench('file  ', fileStore, keys, entries);

    final sqliteStore = SqlitePersistentCacheStore<Map<String, Object?>>(
      toJson: (value) => value,
      fromJson: (json) => Map<String, Object?>.from(json as Map),
      databaseFactory: databaseFactoryFfi,
      databasePathResolver: () async => sqliteDir.path,
      dbName: 'bench.db',
    );
    await bench('sqlite', sqliteStore, keys, entries);
    await sqliteStore.close();
  } finally {
    await fileDir.delete(recursive: true);
    await sqliteDir.delete(recursive: true);
  }
}
