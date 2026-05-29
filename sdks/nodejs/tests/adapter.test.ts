import { describe, expect, it } from "vitest";
import { createCacheMetadata, type CacheEntry } from "../../javascript/entry/cache.entry.js";
import { computeCacheKey, h57HashFn } from "../../javascript/key/cache.key.js";
import { NodeMemoryPersistentStore } from "../src/stores/memory.persistent.store.js";
import { toIndexedDbCompatibleStore } from "../src/adapters/persistent.to.indexeddb.js";

describe("persistent adapter", () => {
  it("round-trips set/get/delete", async () => {
    const store = new NodeMemoryPersistentStore<{ value: string }>({ now: () => 1000 });
    const adapter = toIndexedDbCompatibleStore(store);
    const key = computeCacheKey(
      {
        namespace: "test",
        operationId: "adapter",
        payload: { label: "k1" },
        schemaVersion: "v1",
        specChecksum: "spec-v1",
        userScope: "test-user"
      },
      h57HashFn
    );

    const entry: CacheEntry<{ value: string }> = {
      cache_key: key,
      data: { value: "v1" },
      metadata: createCacheMetadata({
        source: "API",
        createdAt: 1000,
        ttlMs: 5000,
        schemaVersion: "schema-v1",
        dataVersion: "dv-1",
        specChecksum: "spec-v1",
        cacheNamespace: "ns-v1",
        compressed: false
      })
    };

    await adapter.set(entry);
    const got = await adapter.get(key);
    expect(got?.data.value).toBe("v1");

    await adapter.delete(key);
    const after = await adapter.get(key);
    expect(after).toBeUndefined();
  });
});
