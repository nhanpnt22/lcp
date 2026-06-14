import 'dart:io';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:test/test.dart';

void main() {
  group('FilePersistentCacheStore', () {
    test('round-trips a valid cache entry', () async {
      final harness = await _createHarness(nowMs: 2000);
      final key = _h57Key('k1');

      final entry = _entry(
        cacheKey: key,
        data: {'name': 'Alice'},
        createdAt: 1000,
        ttlMs: 5000,
      );
      await harness.store.set(entry);

      final loaded = await harness.store.get(key);
      expect(loaded, isNotNull);
      expect(loaded!.cacheKey, equals(key));
      expect(loaded.data['name'], equals('Alice'));
      expect(loaded.metadata.expiresAt, equals(6000));

      await harness.dispose();
    });

    test('overwrites existing key', () async {
      final harness = await _createHarness(nowMs: 2000);
      final key = _h57Key('overwrite');

      await harness.store.set(
        _entry(
          cacheKey: key,
          data: {'name': 'Alice'},
          createdAt: 1000,
          ttlMs: 5000,
        ),
      );
      await harness.store.set(
        _entry(
          cacheKey: key,
          data: {'name': 'Bob'},
          createdAt: 1000,
          ttlMs: 5000,
        ),
      );

      final loaded = await harness.store.get(key);
      expect(loaded, isNotNull);
      expect(loaded!.data['name'], equals('Bob'));

      await harness.dispose();
    });

    test('delete removes entry', () async {
      final harness = await _createHarness(nowMs: 2000);
      final key = _h57Key('delete');

      await harness.store.set(
        _entry(
          cacheKey: key,
          data: {'v': 1},
          createdAt: 1000,
          ttlMs: 5000,
        ),
      );
      await harness.store.delete(key);

      final loaded = await harness.store.get(key);
      expect(loaded, isNull);

      await harness.dispose();
    });

    test('clear removes all entries', () async {
      final harness = await _createHarness(nowMs: 2000);
      final key1 = _h57Key('clear-1');
      final key2 = _h57Key('clear-2');

      await harness.store.set(
        _entry(
          cacheKey: key1,
          data: {'v': 1},
          createdAt: 1000,
          ttlMs: 5000,
        ),
      );
      await harness.store.set(
        _entry(
          cacheKey: key2,
          data: {'v': 2},
          createdAt: 1000,
          ttlMs: 5000,
        ),
      );

      await harness.store.clear();

      expect(await harness.store.get(key1), isNull);
      expect(await harness.store.get(key2), isNull);

      await harness.dispose();
    });

    test('returns null and removes entry when expired', () async {
      final harness = await _createHarness(nowMs: 7000);
      final expiredKey = _h57Key('expired');

      final expired = _entry(
        cacheKey: expiredKey,
        data: {'v': 1},
        createdAt: 1000,
        ttlMs: 5000,
      );
      await harness.store.set(expired);

      final loaded = await harness.store.get(expiredKey);
      expect(loaded, isNull);

      final hydrated = await harness.store.hydrateAllValid(now: 7000);
      expect(hydrated, isEmpty);

      await harness.dispose();
    });

    test('pruneExpired removes only expired entries', () async {
      final harness = await _createHarness(nowMs: 6500);
      final expiredKey = _h57Key('expired');
      final validKey = _h57Key('valid');

      await harness.store.set(
        _entry(
          cacheKey: expiredKey,
          data: {'v': 1},
          createdAt: 1000,
          ttlMs: 5000,
        ),
      );
      await harness.store.set(
        _entry(
          cacheKey: validKey,
          data: {'v': 2},
          createdAt: 2000,
          ttlMs: 10000,
        ),
      );

      final removed = await harness.store.pruneExpired(now: 6500);
      expect(removed, equals(1));

      final valid = await harness.store.get(validKey);
      final expired = await harness.store.get(expiredKey);
      expect(valid, isNotNull);
      expect(expired, isNull);

      await harness.dispose();
    });

    test('hydrateAllValid excludes expired and respects limit', () async {
      final harness = await _createHarness(nowMs: 3000);
      final keyA = _h57Key('a');
      final keyB = _h57Key('b');
      final expiredKey = _h57Key('expired');

      await harness.store.set(
        _entry(
          cacheKey: keyA,
          data: {'rank': 1},
          createdAt: 1000,
          ttlMs: 10000,
        ),
      );
      await harness.store.set(
        _entry(
          cacheKey: keyB,
          data: {'rank': 2},
          createdAt: 2000,
          ttlMs: 10000,
        ),
      );
      await harness.store.set(
        _entry(
          cacheKey: expiredKey,
          data: {'rank': 3},
          createdAt: 0,
          ttlMs: 100,
        ),
      );

      final hydrated = await harness.store.hydrateAllValid(now: 3000);
      expect(hydrated.map((e) => e.cacheKey).toSet(), equals({keyA, keyB}));

      final limited = await harness.store.hydrateAllValid(now: 3000, limit: 1);
      expect(limited, hasLength(1));

      await harness.dispose();
    });
  });
}

String _h57Key(String label) {
  return computeCacheKey(
    CacheKeyInput(
      namespace: 'test',
      operationId: label,
      payload: {'label': label},
      schemaVersion: 'v1',
      specChecksum: 'spec-v1',
      userScope: 'test-user',
    ),
    h57HashFn,
  );
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
  final dir = await Directory.systemTemp.createTemp('lcp_file_store_test_');
  final store = FilePersistentCacheStore<Map<String, Object?>>(
    toJson: (value) => value,
    fromJson: (json) => Map<String, Object?>.from(json as Map),
    now: () => DateTime.fromMillisecondsSinceEpoch(nowMs),
    rootDirResolver: () async => dir.path,
  );
  return _StoreHarness(store: store, dir: dir);
}

class _StoreHarness {
  _StoreHarness({
    required this.store,
    required this.dir,
  });

  final FilePersistentCacheStore<Map<String, Object?>> store;
  final Directory dir;

  Future<void> dispose() async {
    if (await dir.exists()) {
      await dir.delete(recursive: true);
    }
  }
}
