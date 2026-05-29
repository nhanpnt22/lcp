export type InFlightFactory<T> = () => Promise<T>;

/**
 * Single-flight deduplication keyed by cache_key only.
 *
 * Guarantees:
 * - Concurrent requests sharing the same cacheKey share one Promise
 * - Entry cleanup always runs after settle (resolve/reject)
 * - request_id is intentionally not used for keying
 */
export class CacheSingleFlight {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /**
   * Returns an existing in-flight promise for cacheKey, or starts one.
   */
  run<T>(cacheKey: string, factory: InFlightFactory<T>): Promise<T> {
    const existing = this.inFlight.get(cacheKey) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const promise = factory().finally(() => {
      // Cleanup by cache_key only to preserve single-flight semantics.
      this.inFlight.delete(cacheKey);
    });

    this.inFlight.set(cacheKey, promise as Promise<unknown>);
    return promise;
  }

  /**
   * Introspection helper for tests/metrics.
   */
  size(): number {
    return this.inFlight.size;
  }

  /**
   * Returns true when a cache_key currently has an in-flight operation.
   */
  has(cacheKey: string): boolean {
    return this.inFlight.has(cacheKey);
  }
}
