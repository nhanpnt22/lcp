import { describe, expect, it } from "vitest";
import { MemoryCacheStore } from "../../storage/cache.store.memory";
import { buildEntry } from "../helpers/fixtures";

describe("storage/cache.store.memory", () => {
  it("returns undefined and removes expired entries on read", () => {
    const store = new MemoryCacheStore<{ value: number }>({ maxEntries: 5, now: () => 1000 });
    store.set(buildEntry({ cacheKey: "k1", data: { value: 1 }, createdAt: 100, ttlMs: 200 }));

    expect(store.get("k1")).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it("evicts least recently used when maxEntries is exceeded", () => {
    const store = new MemoryCacheStore<{ value: number }>({ maxEntries: 2, now: () => 150 });
    store.set(buildEntry({ cacheKey: "k1", data: { value: 1 }, createdAt: 100, ttlMs: 1000 }));
    store.set(buildEntry({ cacheKey: "k2", data: { value: 2 }, createdAt: 100, ttlMs: 1000 }));

    store.get("k1");
    store.set(buildEntry({ cacheKey: "k3", data: { value: 3 }, createdAt: 100, ttlMs: 1000 }));

    expect(store.peek("k1")).toBeDefined();
    expect(store.peek("k2")).toBeUndefined();
    expect(store.peek("k3")).toBeDefined();
  });
});
