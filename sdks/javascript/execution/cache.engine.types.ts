import type { CacheEntry } from "../entry";
import type { CacheKeyInput, H57HashFunction } from "../key/cache.key";
import type { CacheSingleFlight } from "../singleflight";
import type { MemoryCacheStore } from "../storage/cache.store.memory";
import type { IndexedDbCacheStore } from "../storage/cache.store.idb";
import type { ResumeStateRecord, ResumeStateStore } from "../resume";

export interface FetchApiResult<T> {
  data: T;
  ttlMs?: number;
  headers?: Headers | Record<string, string | undefined>;
}

export interface ReadThroughRequest<T> {
  keyInput: CacheKeyInput;
  h57Hash: H57HashFunction;
  fetchFromApi: () => Promise<FetchApiResult<T>>;
  allowStaleOnExpired?: boolean;
  resumeState?: ResumeStateRecord;
  trace?: {
    request_id: string;
    trace_id: string;
    action_id: string;
  };
  onBackgroundRefresh?: (params: {
    cacheKey: string;
    requestId?: string;
  }) => Promise<void> | void;
}

export interface ReadThroughResponse<T> {
  cacheKey: string;
  source: "API" | "CACHE";
  data: T;
  stale: boolean;
}

export interface CacheParity {
  schemaVersion: string;
  specChecksum: string;
  cacheNamespace: string;
  dataVersion: string;
}

export interface ReadThroughEngineOptions<T> {
  memoryStore: MemoryCacheStore<T>;
  indexedDbStore?: IndexedDbCacheStore<T>;
  singleFlight?: CacheSingleFlight;
  now?: () => number;
  persistence?: {
    mode?: "auto" | "memory-only" | "dual";
    shortThresholdMs?: number;
    shouldPersistToIndexedDb?: (entry: CacheEntry<T>) => boolean;
  };
  parity: CacheParity;
  resume?: {
    store?: ResumeStateStore;
    resolveState?: (params: {
      source: "API" | "CACHE";
      data: T;
      cacheKey: string;
      request: ReadThroughRequest<T>;
    }) => ResumeStateRecord | undefined;
  };
}
