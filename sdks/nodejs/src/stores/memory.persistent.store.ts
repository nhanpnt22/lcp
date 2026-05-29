import type { CacheEntry } from "@sdp/lcp-javascript-sdk";
import type { NodePersistentStore } from "../types.js";
import { assertH57CacheKey } from "../cache.key.validation.js";

export class NodeMemoryPersistentStore<T = unknown> implements NodePersistentStore<T> {
  private readonly now: () => number;
  private readonly maxEntries: number;
  private readonly map = new Map<string, CacheEntry<T>>();

  constructor(options?: { maxEntries?: number; now?: () => number }) {
    this.now = options?.now ?? (() => Date.now());
    this.maxEntries = options?.maxEntries ?? 2000;
  }

  async get(cacheKey: string): Promise<CacheEntry<T> | undefined> {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-memory.get");
    const entry = this.map.get(normalizedKey);
    if (!entry) return undefined;
    if (this.now() >= entry.metadata.expires_at) {
      this.map.delete(normalizedKey);
      return undefined;
    }
    this.map.delete(normalizedKey);
    this.map.set(normalizedKey, entry);
    return entry;
  }

  async set(entry: CacheEntry<T>): Promise<void> {
    const normalizedKey = assertH57CacheKey(entry.cache_key, "node-memory.set");
    this.map.set(normalizedKey, { ...entry, cache_key: normalizedKey });
    if (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }
  }

  async delete(cacheKey: string): Promise<void> {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-memory.delete");
    this.map.delete(normalizedKey);
  }

  async clear(): Promise<void> {
    this.map.clear();
  }

  async pruneExpired(nowMs?: number): Promise<number> {
    const threshold = nowMs ?? this.now();
    let removed = 0;
    for (const [key, entry] of this.map.entries()) {
      if (threshold >= entry.metadata.expires_at) {
        this.map.delete(key);
        removed++;
      }
    }
    return removed;
  }

  async hydrateAllValid(limit?: number): Promise<CacheEntry<T>[]> {
    const max =
      typeof limit === "number" && Number.isInteger(limit) && limit > 0
        ? limit
        : Number.MAX_SAFE_INTEGER;
    const out: CacheEntry<T>[] = [];
    const threshold = this.now();
    const values = Array.from(this.map.values()).reverse();
    for (const entry of values) {
      if (threshold < entry.metadata.expires_at) out.push(entry);
      if (out.length >= max) break;
    }
    return out;
  }
}
