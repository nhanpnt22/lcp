import type { CacheEntry } from "../entry";
import type { CacheFailureStage } from "../failure";
import { classifyCacheFailure } from "../failure";
import type { IndexedDbCacheStore } from "../storage/cache.store.idb";
import type { MemoryCacheStore } from "../storage/cache.store.memory";
import { evaluateTtl } from "../ttl";
import { assertCacheEntryInvariants } from "../validation";
import type { CacheParity, ReadThroughResponse } from "./cache.engine.types";

export interface CacheLookupResult<T> {
  entry?: CacheEntry<T>;
  stale: boolean;
  hydrateMemory: boolean;
}

export const DEFAULT_SHORT_THRESHOLD_MS = 300_000;

export function resolveShortThresholdMs(rawShortThresholdMs?: number): number {
  if (typeof rawShortThresholdMs !== "number" || !Number.isFinite(rawShortThresholdMs)) {
    return DEFAULT_SHORT_THRESHOLD_MS;
  }
  return Math.max(0, Math.floor(rawShortThresholdMs));
}

export function toCacheResponse<T>(
  cacheKey: string,
  entry: CacheEntry<T>,
  stale: boolean
): ReadThroughResponse<T> {
  return {
    cacheKey,
    source: "CACHE",
    data: entry.data,
    stale
  };
}

export function getExpiredStaleCandidate<T>(
  memoryStore: Pick<MemoryCacheStore<T>, "peek">,
  cacheKey: string,
  now: () => number
): CacheEntry<T> | undefined {
  const peek = memoryStore.peek(cacheKey);
  if (!peek) {
    return undefined;
  }

  const ttl = evaluateTtl({
    createdAt: peek.metadata.created_at,
    ttlMs: peek.metadata.ttl_ms,
    now: now()
  });

  return ttl.status === "EXPIRED" ? peek : undefined;
}

export function toFailureFallback<T>(params: {
  stage: CacheFailureStage;
  error: unknown;
  staleEntry: CacheEntry<T> | undefined;
  allowStale: boolean;
}): CacheLookupResult<T> {
  const decision = classifyCacheFailure({
    stage: params.stage,
    error: params.error,
    staleEntry: params.staleEntry,
    allowStale: params.allowStale && Boolean(params.staleEntry)
  });

  if (decision.action === "RETURN_STALE_AND_REFRESH" && decision.staleEntry) {
    return {
      entry: decision.staleEntry,
      stale: true,
      hydrateMemory: false
    };
  }

  if (decision.action === "HARD_FAIL") {
    throw new Error(decision.reason);
  }

  return {
    stale: false,
    hydrateMemory: false
  };
}

export function isEntryValidForRead<T>(
  entry: CacheEntry<T>,
  cacheKey: string,
  parity: CacheParity
): boolean {
  try {
    assertCacheEntryInvariants(entry, {
      parity: {
        schema_version: parity.schemaVersion,
        spec_checksum: parity.specChecksum,
        cache_namespace: parity.cacheNamespace
      },
      expectedCacheKey: cacheKey,
      requireNoSensitiveData: true,
      requireNoTraceInData: true
    });
    return true;
  } catch {
    return false;
  }
}

export function safeMemoryGet<T>(params: {
  memoryStore: MemoryCacheStore<T>;
  cacheKey: string;
  staleEntry: CacheEntry<T> | undefined;
  allowStale: boolean;
}): CacheLookupResult<T> {
  try {
    return {
      entry: params.memoryStore.get(params.cacheKey),
      stale: false,
      hydrateMemory: false
    };
  } catch (error) {
    return toFailureFallback({
      stage: "MEMORY_READ",
      error,
      staleEntry: params.staleEntry,
      allowStale: params.allowStale
    });
  }
}

export async function safeIndexedDbGet<T>(params: {
  indexedDbStore?: IndexedDbCacheStore<T>;
  cacheKey: string;
  staleEntry: CacheEntry<T> | undefined;
  allowStale: boolean;
  parity: CacheParity;
  onInvalidEntry: (cacheKey: string) => Promise<void>;
}): Promise<CacheLookupResult<T>> {
  if (!params.indexedDbStore) {
    return {
      stale: false,
      hydrateMemory: false
    };
  }

  try {
    const entry = await params.indexedDbStore.get(params.cacheKey);
    if (!entry) {
      return {
        stale: false,
        hydrateMemory: false
      };
    }

    if (!isEntryValidForRead(entry, params.cacheKey, params.parity)) {
      await params.onInvalidEntry(params.cacheKey);
      return {
        stale: false,
        hydrateMemory: false
      };
    }

    return {
      entry,
      stale: false,
      hydrateMemory: true
    };
  } catch (error) {
    return toFailureFallback({
      stage: "IDB_READ",
      error,
      staleEntry: params.staleEntry,
      allowStale: params.allowStale
    });
  }
}
