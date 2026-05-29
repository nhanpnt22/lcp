import '../entry/cache_entry.dart';
import '../singleflight/cache_single_flight.dart';
import '../storage/memory_cache_store.dart';
import '../storage/persistent_cache_store.dart';
import '../ttl/cache_ttl.dart';
import '../validation/cache_validation.dart';

class SwrFetchResult<T> {
  const SwrFetchResult({
    required this.data,
    this.ttlMs,
    this.headers,
  });

  final T data;
  final int? ttlMs;
  final Map<String, String?>? headers;
}

class SwrRefreshRequest<T> {
  const SwrRefreshRequest({
    required this.cacheKey,
    required this.staleEntry,
    required this.requestId,
    required this.singleFlight,
    required this.memoryStore,
    required this.fetchFromApi,
    required this.parity,
    this.persistentStore,
    this.now,
  });

  final String cacheKey;
  final CacheEntry<T> staleEntry;
  final String requestId;
  final CacheSingleFlight<void> singleFlight;
  final MemoryCacheStore<T> memoryStore;
  final PersistentCacheStore<T>? persistentStore;
  final Future<SwrFetchResult<T>> Function(String requestId) fetchFromApi;
  final CacheMetadataParityExpectation parity;
  final int Function()? now;
}

void scheduleSwrRefresh<T>(SwrRefreshRequest<T> request) {
  if (request.requestId.trim().isEmpty) {
    throw ArgumentError.value(request.requestId, 'requestId',
        'SWR refresh requires a non-empty requestId');
  }

  final now = request.now ?? (() => DateTime.now().millisecondsSinceEpoch);

  Future<void>.microtask(() async {
    try {
      await request.singleFlight.run(request.cacheKey, () async {
        final api = await request.fetchFromApi(request.requestId);
        final ttlMs = api.ttlMs ??
            (api.headers != null ? extractOacTtlMs(api.headers!) : null);

        if (ttlMs == null) {
          return;
        }

        final metadata = createCacheMetadata(
          source: CacheSource.api,
          createdAt: now(),
          ttlMs: ttlMs,
          schemaVersion: request.parity.schemaVersion,
          dataVersion: request.staleEntry.metadata.dataVersion,
          specChecksum: request.parity.specChecksum,
          cacheNamespace: request.parity.cacheNamespace,
          compressed: request.staleEntry.metadata.compressed,
        );

        final refreshed = CacheEntry<T>(
          cacheKey: request.cacheKey,
          data: api.data,
          metadata: metadata,
        );

        assertCacheEntryInvariants(
          refreshed,
          ValidationOptions(
            parity: request.parity,
            expectedCacheKey: request.cacheKey,
            requireNoSensitiveData: true,
            requireNoTraceInData: true,
          ),
        );

        try {
          request.memoryStore.set(refreshed);
        } catch (_) {
          // SWR memory write failures are intentionally non-blocking.
        }

        try {
          await request.persistentStore?.set(refreshed);
        } catch (_) {
          // SWR persistence failures are intentionally non-blocking.
        }
      });
    } catch (_) {
      // SWR failures are intentionally non-blocking and non-fatal.
    }
  });
}
