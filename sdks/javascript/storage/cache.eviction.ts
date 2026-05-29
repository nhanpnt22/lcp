import type { CacheEntry } from "../entry";

export interface EvictionPlanInput<T> {
  entriesInLruOrder: CacheEntry<T>[];
  maxEntries: number;
  now: number;
}

/**
 * Builds a deterministic eviction plan.
 *
 * Policy:
 * 1) Evict expired entries first (oldest LRU order).
 * 2) If still oversized, evict oldest non-expired entries by LRU order.
 */
export function buildDeterministicEvictionPlan<T>(
  input: EvictionPlanInput<T>
): string[] {
  if (!Number.isInteger(input.maxEntries) || input.maxEntries <= 0) {
    throw new TypeError("maxEntries must be a positive integer");
  }

  if (input.entriesInLruOrder.length <= input.maxEntries) {
    return [];
  }

  const expired: string[] = [];
  const alive: string[] = [];

  for (const entry of input.entriesInLruOrder) {
    if (input.now >= entry.metadata.expires_at) {
      expired.push(entry.cache_key);
    } else {
      alive.push(entry.cache_key);
    }
  }

  const toRemove = input.entriesInLruOrder.length - input.maxEntries;
  if (expired.length >= toRemove) {
    return expired.slice(0, toRemove);
  }

  return expired.concat(alive.slice(0, toRemove - expired.length));
}
