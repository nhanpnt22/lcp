import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:test/test.dart';

void main() {
  test('memory cache get returns valid entry', () {
    final store = MemoryCacheStore<Map<String, Object>>(
      maxEntries: 2,
      now: () => 100,
    );
    final entry = CacheEntry<Map<String, Object>>(
      cacheKey: 'k1',
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
    expect(store.get('k1')?.data['ok'], isTrue);
  });

  test('memory cache evicts oldest when over capacity', () {
    final store = MemoryCacheStore<int>(maxEntries: 1, now: () => 0);
    store.set(
      CacheEntry<int>(
        cacheKey: 'a',
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
        cacheKey: 'b',
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

    expect(store.get('a'), isNull);
    expect(store.get('b')?.data, equals(2));
  });
}
