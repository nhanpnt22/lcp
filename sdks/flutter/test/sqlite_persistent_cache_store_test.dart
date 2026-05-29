import 'dart:io';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:test/test.dart';

void main() {
  sqfliteFfiInit();

  group('SqlitePersistentCacheStore', () {
    test('round-trips a valid cache entry', () async {
      final harness = await _createHarness(nowMs: 2000);

      final entry = _entry(
        cacheKey: 'k1',
        data: {'name': 'Alice'},
        createdAt: 1000,
        ttlMs: 5000,
      );
      await harness.store.set(entry);

      final loaded = await harness.store.get('k1');
      expect(loaded, isNotNull);
      expect(loaded!.cacheKey, equals('k1'));
      expect(loaded.data['name'], equals('Alice'));
      expect(loaded.metadata.expiresAt, equals(6000));

      await harness.dispose();
    });

    test('returns null and removes entry when expired', () async {
      final harness = await _createHarness(nowMs: 7000);

      final expired = _entry(
        cacheKey: 'expired',
        data: {'v': 1},
        createdAt: 1000,
        ttlMs: 5000,
      );
      await harness.store.set(expired);

      final loaded = await harness.store.get('expired');
      expect(loaded, isNull);

      final hydrated = await harness.store.hydrateAllValid(now: 7000);
      expect(hydrated, isEmpty);

      await harness.dispose();
    });

    test('pruneExpired removes only expired entries', () async {
      final harness = await _createHarness(nowMs: 6500);

      await harness.store.set(
        _entry(
          cacheKey: 'expired',
          data: {'v': 1},
          createdAt: 1000,
          ttlMs: 5000,
        ),
      );
      await harness.store.set(
        _entry(
          cacheKey: 'valid',
          data: {'v': 2},
          createdAt: 2000,
          ttlMs: 10000,
        ),
      );

      final removed = await harness.store.pruneExpired(now: 6500);
      expect(removed, equals(1));

      final valid = await harness.store.get('valid');
      final expired = await harness.store.get('expired');
      expect(valid, isNotNull);
      expect(expired, isNull);

      await harness.dispose();
    });

    test('hydrateAllValid honors ordering and limit', () async {
      final harness = await _createHarness(nowMs: 3000);

      await harness.store.set(
        _entry(
          cacheKey: 'older',
          data: {'rank': 1},
          createdAt: 1000,
          ttlMs: 10000,
        ),
      );
      await harness.store.set(
        _entry(
          cacheKey: 'newer',
          data: {'rank': 2},
          createdAt: 2000,
          ttlMs: 10000,
        ),
      );

      final hydrated = await harness.store.hydrateAllValid(now: 3000, limit: 1);
      expect(hydrated, hasLength(1));
      expect(hydrated.first.cacheKey, equals('newer'));

      await harness.dispose();
    });
  });
}

CacheEntry<Map<String, Object?>> _entry({
  required String cacheKey,
  required Map<String, Object?> data,
  required int createdAt,
  required int ttlMs,
}) {
  return CacheEntry<Map<String, Object?>>(
    cacheKey: cacheKey,
    data: data,
    metadata: createCacheMetadata(
      source: CacheSource.api,
      createdAt: createdAt,
      ttlMs: ttlMs,
      schemaVersion: 'v1',
      dataVersion: 'v1',
      specChecksum: 'spec',
      cacheNamespace: 'ns',
    ),
  );
}

Future<_StoreHarness> _createHarness({required int nowMs}) async {
  final dir = await Directory.systemTemp.createTemp('lcp_sqlite_store_test_');
  final store = SqlitePersistentCacheStore<Map<String, Object?>>(
    toJson: (value) => value,
    fromJson: (json) => Map<String, Object?>.from(json as Map),
    now: () => DateTime.fromMillisecondsSinceEpoch(nowMs),
    databaseFactory: databaseFactoryFfi,
    databasePathResolver: () async => dir.path,
    dbName: 'test.db',
  );
  return _StoreHarness(store: store, dir: dir);
}

class _StoreHarness {
  _StoreHarness({
    required this.store,
    required this.dir,
  });

  final SqlitePersistentCacheStore<Map<String, Object?>> store;
  final Directory dir;

  Future<void> dispose() async {
    await store.close();
    if (await dir.exists()) {
      await dir.delete(recursive: true);
    }
  }
}
