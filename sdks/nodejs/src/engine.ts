import {
  ReadThroughCacheEngine
} from "@sdp/lcp-javascript-sdk";
import type {
  CacheEntry,
  CacheSingleFlight,
  MemoryCacheStore,
  ReadThroughEngineOptions
} from "@sdp/lcp-javascript-sdk";
import { toIndexedDbCompatibleStore } from "./adapters/persistent.to.indexeddb.js";
import type { NodePersistentStore } from "./types.js";

export interface NodeReadThroughEngineOptions<T> {
  memoryStore: MemoryCacheStore<T>;
  persistentStore?: NodePersistentStore<T>;
  singleFlight?: CacheSingleFlight;
  now?: () => number;
  parity: ReadThroughEngineOptions<T>["parity"];
  persistence?: {
    mode?: "auto" | "memory-only" | "dual";
    shortThresholdMs?: number;
    shouldPersistToIndexedDb?: (entry: CacheEntry<T>) => boolean;
  };
}

export function createNodeReadThroughCacheEngine<T>(
  options: NodeReadThroughEngineOptions<T>
): ReadThroughCacheEngine<T> {
  const indexedDbStore = options.persistentStore
    ? (toIndexedDbCompatibleStore(options.persistentStore) as any)
    : undefined;

  return new ReadThroughCacheEngine<T>({
    memoryStore: options.memoryStore,
    indexedDbStore,
    singleFlight: options.singleFlight,
    now: options.now,
    parity: options.parity,
    persistence: options.persistence
  });
}

