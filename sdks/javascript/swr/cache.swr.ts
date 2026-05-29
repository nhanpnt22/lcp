import { createCacheMetadata, type CacheEntry } from "../entry";
import type { CacheSingleFlight } from "../singleflight";
import type { MemoryCacheStore } from "../storage/cache.store.memory";
import type { IndexedDbCacheStore } from "../storage/cache.store.idb";
import { extractOacTtlMs } from "../ttl";
import { assertCacheEntryInvariants } from "../validation";

export interface SwrFetchResult<T> {
  data: T;
  ttlMs?: number;
  headers?: Headers | Record<string, string | undefined>;
}

export interface SwrRefreshRequest<T> {
  cacheKey: string;
  staleEntry: CacheEntry<T>;
  requestId: string;
  singleFlight: CacheSingleFlight;
  memoryStore: MemoryCacheStore<T>;
  indexedDbStore?: IndexedDbCacheStore<T>;
  fetchFromApi: (requestId: string) => Promise<SwrFetchResult<T>>;
  parity: {
    schemaVersion: string;
    specChecksum: string;
    cacheNamespace: string;
    dataVersion: string;
  };
  now?: () => number;
}

/**
 * Schedules SWR refresh as async non-blocking work with cache_key single-flight.
 */
export function scheduleSwrRefresh<T>(request: SwrRefreshRequest<T>): void {
  if (!request.requestId?.trim()) {
    throw new TypeError("SWR refresh requires the same non-empty requestId");
  }

  const now = request.now ?? (() => Date.now());

  queueMicrotask(() => {
    request.singleFlight.run(request.cacheKey, async () => {
      const api = await request.fetchFromApi(request.requestId);
      const ttlMs = api.ttlMs ?? (api.headers ? extractOacTtlMs(api.headers) : undefined);

      // OAC-authoritative missing TTL means no refresh write.
      if (ttlMs === undefined) {
        return;
      }

      const metadata = createCacheMetadata({
        source: "API",
        createdAt: now(),
        ttlMs,
        schemaVersion: request.parity.schemaVersion,
        dataVersion: request.parity.dataVersion,
        specChecksum: request.parity.specChecksum,
        cacheNamespace: request.parity.cacheNamespace,
        compressed: request.staleEntry.metadata.compressed
      });

      const refreshed: CacheEntry<T> = {
        cache_key: request.cacheKey,
        data: api.data,
        metadata
      };

      assertCacheEntryInvariants(refreshed, {
        parity: {
          schema_version: request.parity.schemaVersion,
          spec_checksum: request.parity.specChecksum,
          cache_namespace: request.parity.cacheNamespace
        },
        expectedCacheKey: request.cacheKey,
        requireNoSensitiveData: true,
        requireNoTraceInData: true
      });

      request.memoryStore.set(refreshed);
      if (request.indexedDbStore) {
        await request.indexedDbStore.set(refreshed);
      }
    }).catch(() => {
      // SWR failures are intentionally non-blocking and non-fatal.
    });
  });
}
