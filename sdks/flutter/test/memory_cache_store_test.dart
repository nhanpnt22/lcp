import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:test/test.dart';

void main() {
  test('memory cache get returns valid entry', () {
    final store = MemoryCacheStore<Map<String, Object>>(
      maxEntries: 2,
      now: () => 100,
    );
    final key = _h57Key('k1');
    final entry = CacheEntry<Map<String, Object>>(
      cacheKey: key,
      data: {'ok': true},
      metadata: createCacheMetadata(
        source: CacheSource.api,
        createdAt: 0,
        ttlMs: 1000,
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
    );

    store.set(entry);
    expect(store.get(key)?.data['ok'], isTrue);
  });

  test('memory cache evicts oldest when over capacity', () {
    final store = MemoryCacheStore<int>(maxEntries: 1, now: () => 0);
    final keyA = _h57Key('a');
    final keyB = _h57Key('b');
    store.set(
      CacheEntry<int>(
        cacheKey: keyA,
        data: 1,
        metadata: createCacheMetadata(
          source: CacheSource.api,
          createdAt: 0,
          ttlMs: 1000,
          schemaVersion: 'v1',
          dataVersion: 'v1',
          specChecksum: 'spec',
          cacheNamespace: 'ns',
        ),
      ),
    );
    store.set(
      CacheEntry<int>(
        cacheKey: keyB,
        data: 2,
        metadata: createCacheMetadata(
          source: CacheSource.api,
          createdAt: 0,
          ttlMs: 1000,
          schemaVersion: 'v1',
          dataVersion: 'v1',
          specChecksum: 'spec',
          cacheNamespace: 'ns',
        ),
      ),
    );

    expect(store.get(keyA), isNull);
    expect(store.get(keyB)?.data, equals(2));
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
