import type { CacheEntry } from "@sdp/lcp-javascript-sdk";
import type { NodePersistentStore } from "../types.js";

export function toIndexedDbCompatibleStore<T>(store: NodePersistentStore<T>) {
  return {
    get(cacheKey: string): Promise<CacheEntry<T> | undefined> {
      return store.get(cacheKey);
    },
    set(entry: CacheEntry<T>): Promise<void> {
      return store.set(entry);
    },
    delete(cacheKey: string): Promise<void> {
      return store.delete(cacheKey);
    },
    clear(): Promise<void> {
      return store.clear();
    },
    pruneExpired(): Promise<number> {
      return store.pruneExpired();
    },
    hydrateAllValid(limit?: number): Promise<CacheEntry<T>[]> {
      return store.hydrateAllValid(limit);
    }
  };
}
