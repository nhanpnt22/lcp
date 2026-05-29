import 'dart:convert';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:test/test.dart';

void main() {
  test('engine returns API then cache on second call', () async {
    final store = MemoryCacheStore<Map<String, dynamic>>(maxEntries: 10, now: () => 1000);
    var calls = 0;

    final engine = ReadThroughCacheEngine<Map<String, dynamic>>(
      memoryStore: store,
      parity: const CacheParity(
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
      now: () => 1000,
    );

    final request = CacheRequest<Map<String, dynamic>>(
      keyInput: const CacheKeyInput(
        namespace: 'profile',
        operationId: 'get',
        payload: {'userId': 'u1'},
        schemaVersion: 'v1',
        specChecksum: 'spec',
        userScope: 'u1',
      ),
      hashFn: (bytes) => base64Url.encode(bytes),
      fetchFromApi: () async {
        calls++;
        return const ApiFetchResult<Map<String, dynamic>>(
          data: {'name': 'Alice'},
          ttlMs: 60000,
        );
      },
    );

    final first = await engine.execute(request);
    final second = await engine.execute(request);

    expect(first.source, equals(CacheSource.api));
    expect(second.source, equals(CacheSource.cache));
    expect(calls, equals(1));
  });

  test('engine bypasses write when ttl is missing', () async {
    final store = MemoryCacheStore<Map<String, dynamic>>(maxEntries: 10, now: () => 1000);
    var calls = 0;

    final engine = ReadThroughCacheEngine<Map<String, dynamic>>(
      memoryStore: store,
      parity: const CacheParity(
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
      now: () => 1000,
    );

    final request = CacheRequest<Map<String, dynamic>>(
      keyInput: const CacheKeyInput(
        namespace: 'profile',
        operationId: 'get',
        payload: {'userId': 'u1'},
        schemaVersion: 'v1',
        specChecksum: 'spec',
        userScope: 'u1',
      ),
      hashFn: (bytes) => base64Url.encode(bytes),
      fetchFromApi: () async {
        calls++;
        return const ApiFetchResult<Map<String, dynamic>>(
          data: {'name': 'Alice'},
        );
      },
    );

    final first = await engine.execute(request);
    final second = await engine.execute(request);

    expect(first.source, equals(CacheSource.api));
    expect(second.source, equals(CacheSource.api));
    expect(calls, equals(2));
  });

  test('engine bypasses stale cache when resume store has newer state without request resumeState', () async {
    final store = MemoryCacheStore<Map<String, dynamic>>(maxEntries: 10, now: () => 1000);
    final resumeStore = InMemoryResumeStateStore()
      ..update(
        ResumeState(
          widgetId: 'widget-1',
          stateVersion: 3,
        ),
      );

    final cacheEntry = CacheEntry<Map<String, dynamic>>(
      cacheKey: 'cached-key',
      data: {
        'widget_id': 'widget-1',
        'state_version': 2,
        'name': 'stale-cache',
      },
      metadata: createCacheMetadata(
        source: CacheSource.cache,
        createdAt: 500,
        ttlMs: 10000,
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
    );
    store.set(cacheEntry);

    var calls = 0;
    final engine = ReadThroughCacheEngine<Map<String, dynamic>>(
      memoryStore: store,
      parity: const CacheParity(
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
      resumeStore: resumeStore,
      now: () => 1000,
    );

    final result = await engine.execute(
      CacheRequest<Map<String, dynamic>>(
        keyInput: const CacheKeyInput(
          namespace: 'profile',
          operationId: 'get',
          payload: {'userId': 'u1'},
          schemaVersion: 'v1',
          specChecksum: 'spec',
          userScope: 'u1',
        ),
        hashFn: (bytes) => 'cached-key',
        fetchFromApi: () async {
          calls++;
          return const ApiFetchResult<Map<String, dynamic>>(
            data: {'name': 'fresh-api'},
            ttlMs: 60000,
          );
        },
      ),
    );

    expect(calls, equals(1));
    expect(result.source, equals(CacheSource.api));
    expect(result.data['name'], equals('fresh-api'));
  });

  test('engine continues when memory write fails', () async {
    final store = _ThrowingMemoryCacheStore<Map<String, dynamic>>(maxEntries: 10, now: () => 1000);
    var calls = 0;

    final engine = ReadThroughCacheEngine<Map<String, dynamic>>(
      memoryStore: store,
      parity: const CacheParity(
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
      now: () => 1000,
    );

    final request = CacheRequest<Map<String, dynamic>>(
      keyInput: const CacheKeyInput(
        namespace: 'profile',
        operationId: 'get',
        payload: {'userId': 'u1'},
        schemaVersion: 'v1',
        specChecksum: 'spec',
        userScope: 'u1',
      ),
      hashFn: (bytes) => base64Url.encode(bytes),
      fetchFromApi: () async {
        calls++;
        return const ApiFetchResult<Map<String, dynamic>>(
          data: {'name': 'Alice'},
          ttlMs: 60000,
        );
      },
    );

    final first = await engine.execute(request);
    final second = await engine.execute(request);

    expect(first.source, equals(CacheSource.api));
    expect(second.source, equals(CacheSource.api));
    expect(calls, equals(2));
  });

  test('engine continues when persistent write fails', () async {
    final store = MemoryCacheStore<Map<String, dynamic>>(maxEntries: 10, now: () => 1000);
    final persistent = _ThrowingPersistentStore<Map<String, dynamic>>();
    var calls = 0;

    final engine = ReadThroughCacheEngine<Map<String, dynamic>>(
      memoryStore: store,
      persistentStore: persistent,
      parity: const CacheParity(
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
      now: () => 1000,
    );

    final result = await engine.execute(
      CacheRequest<Map<String, dynamic>>(
        keyInput: const CacheKeyInput(
          namespace: 'profile',
          operationId: 'get',
          payload: {'userId': 'u1'},
          schemaVersion: 'v1',
          specChecksum: 'spec',
          userScope: 'u1',
        ),
        hashFn: (bytes) => base64Url.encode(bytes),
        fetchFromApi: () async {
          calls++;
          return const ApiFetchResult<Map<String, dynamic>>(
            data: {'name': 'Alice'},
            ttlMs: 60000,
          );
        },
      ),
    );

    expect(result.source, equals(CacheSource.api));
    expect(calls, equals(1));
    expect(persistent.setAttempts, equals(1));
  });
}

class _ThrowingMemoryCacheStore<T> extends MemoryCacheStore<T> {
  _ThrowingMemoryCacheStore({
    required super.maxEntries,
    super.now,
  });

  @override
  void set(CacheEntry<T> entry) {
    throw StateError('simulated memory write failure');
  }
}

class _ThrowingPersistentStore<T> implements PersistentCacheStore<T> {
  int setAttempts = 0;

  @override
  Future<void> clear() async {}

  @override
  Future<void> delete(String cacheKey) async {}

  @override
  Future<CacheEntry<T>?> get(String cacheKey) async => null;

  @override
  Future<List<CacheEntry<T>>> hydrateAllValid({required int now, int? limit}) async => [];

  @override
  Future<int> pruneExpired({required int now}) async => 0;

  @override
  Future<void> set(CacheEntry<T> entry) async {
    setAttempts++;
    throw StateError('simulated persistent write failure');
  }
}
