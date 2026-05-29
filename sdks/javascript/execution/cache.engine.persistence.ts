import type { CacheEntry } from "../entry";
import type { IndexedDbCacheStore } from "../storage/cache.store.idb";
import type { MemoryCacheStore } from "../storage/cache.store.memory";

export function shouldPersistToIndexedDb<T>(params: {
  indexedDbStore?: IndexedDbCacheStore<T>;
  persistenceMode: "auto" | "memory-only" | "dual";
  shortThresholdMs: number;
  entry: CacheEntry<T>;
  override?: (entry: CacheEntry<T>) => boolean;
}): boolean {
  if (!params.indexedDbStore) {
    return false;
  }

  if (params.override) {
    return params.override(params.entry);
  }

  if (params.persistenceMode === "memory-only") {
    return false;
  }

  if (params.persistenceMode === "dual") {
    return true;
  }

  return params.entry.metadata.ttl_ms > params.shortThresholdMs;
}

export function safeMemorySet<T>(memoryStore: MemoryCacheStore<T>, entry: CacheEntry<T>): void {
  try {
    memoryStore.set(entry);
  } catch {
    // Memory write failures are non-authoritative; execution continues.
  }
}

export async function safeIndexedDbSet<T>(
  indexedDbStore: IndexedDbCacheStore<T> | undefined,
  entry: CacheEntry<T>
): Promise<void> {
  if (!indexedDbStore) {
    return;
  }

  try {
    await indexedDbStore.set(entry);
  } catch {
    // IndexedDB persistence is optional and must not block execution.
  }
}

export async function safeIndexedDbDelete<T>(
  indexedDbStore: IndexedDbCacheStore<T> | undefined,
  cacheKey: string
): Promise<void> {
  if (!indexedDbStore) {
    return;
  }

  try {
    await indexedDbStore.delete(cacheKey);
  } catch {
    // Invalid entry cleanup failures are non-authoritative.
  }
}
