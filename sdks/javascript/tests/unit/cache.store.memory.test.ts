import { describe, expect, it } from "vitest";
import { MemoryCacheStore } from "../../storage/cache.store.memory";
import { computeCacheKey, h57HashFn } from "../../key/cache.key";
import { buildEntry } from "../helpers/fixtures";

function h57Key(label: string): string {
  return computeCacheKey(
    {
      namespace: "test",
      operationId: label,
      payload: { label },
      schemaVersion: "v1",
      specChecksum: "spec-v1",
      userScope: "test-user"
    },
    h57HashFn
  );
}

describe("storage/cache.store.memory", () => {
  it("returns undefined and removes expired entries on read", () => {
    const store = new MemoryCacheStore<{ value: number }>({ maxEntries: 5, now: () => 1000 });
    const key = h57Key("k1");
    store.set(buildEntry({ cacheKey: key, data: { value: 1 }, createdAt: 100, ttlMs: 200 }));

    expect(store.get(key)).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it("evicts least recently used when maxEntries is exceeded", () => {
    const store = new MemoryCacheStore<{ value: number }>({ maxEntries: 2, now: () => 150 });
    const key1 = h57Key("k1");
    const key2 = h57Key("k2");
    const key3 = h57Key("k3");
    store.set(buildEntry({ cacheKey: key1, data: { value: 1 }, createdAt: 100, ttlMs: 1000 }));
    store.set(buildEntry({ cacheKey: key2, data: { value: 2 }, createdAt: 100, ttlMs: 1000 }));

    store.get(key1);
    store.set(buildEntry({ cacheKey: key3, data: { value: 3 }, createdAt: 100, ttlMs: 1000 }));

    expect(store.peek(key1)).toBeDefined();
    expect(store.peek(key2)).toBeUndefined();
    expect(store.peek(key3)).toBeDefined();
  });
});
