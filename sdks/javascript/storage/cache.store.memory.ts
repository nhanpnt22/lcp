import type { CacheEntry } from "../entry";
import { buildDeterministicEvictionPlan } from "./cache.eviction";

export interface MemoryStoreOptions {
  maxEntries: number;
  now?: () => number;
}

/**
 * Deterministic in-memory cache store.
 *
 * Behavior:
 * - Authoritative read path for cache layer
 * - TTL evaluated inline on read
 * - Deterministic bounded eviction (expired-first, then LRU)
 */
export class MemoryCacheStore<T = unknown> {
  private readonly maxEntries: number;
  private readonly now: () => number;
  private readonly map = new Map<string, CacheEntry<T>>();

  constructor(options: MemoryStoreOptions) {
    if (!Number.isInteger(options.maxEntries) || options.maxEntries <= 0) {
      throw new TypeError("maxEntries must be a positive integer");
    }
    this.maxEntries = options.maxEntries;
    this.now = options.now ?? (() => Date.now());
  }

  get(cacheKey: string): CacheEntry<T> | undefined {
    const entry = this.map.get(cacheKey);
    if (!entry) {
      return undefined;
    }

    // TTL validation inline for authoritative memory reads.
    if (this.isExpired(entry)) {
      this.map.delete(cacheKey);
      return undefined;
    }

    // LRU touch: move key to most-recent end deterministically.
    this.map.delete(cacheKey);
    this.map.set(cacheKey, entry);
    return entry;
  }

  peek(cacheKey: string): CacheEntry<T> | undefined {
    return this.map.get(cacheKey);
  }

  set(entry: CacheEntry<T>): void {
    this.map.set(entry.cache_key, entry);
    this.evictIfNeeded();
  }

  delete(cacheKey: string): boolean {
    return this.map.delete(cacheKey);
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }

  pruneExpired(): number {
    let removed = 0;
    for (const [key, entry] of this.map.entries()) {
      if (this.isExpired(entry)) {
        this.map.delete(key);
        removed++;
      }
    }
    return removed;
  }

  private isExpired(entry: CacheEntry<T>): boolean {
    return this.now() >= entry.metadata.expires_at;
  }

  private evictIfNeeded(): void {
    if (this.map.size <= this.maxEntries) {
      return;
    }

    const plan = buildDeterministicEvictionPlan({
      entriesInLruOrder: Array.from(this.map.values()),
      maxEntries: this.maxEntries,
      now: this.now()
    });

    for (const key of plan) {
      this.map.delete(key);
    }
  }
}
