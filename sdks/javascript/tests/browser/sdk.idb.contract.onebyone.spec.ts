import { expect, test } from "@playwright/test";

type EntrySeed = {
  cacheKey: string;
  value: string;
  createdAt: number;
  ttlMs: number;
};

test.describe("LCP SDK IndexedDB contract one-by-one", () => {
  test("set/get value after set", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);
      const dbName = `lcp-idb-contract-set-get-${Date.now()}`;

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      const now = () => 1000;
      const store = new sdk.IndexedDbCacheStore({ dbName, now });
      const key = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "k1",
          payload: { suite: "persistent-store", label: "k1" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );

      const entry: EntrySeed = {
        cacheKey: key,
        value: "alpha",
        createdAt: 1000,
        ttlMs: 10000
      };

      await store.set({
        cache_key: entry.cacheKey,
        data: { value: entry.value },
        metadata: sdk.createCacheMetadata({
          source: "API",
          createdAt: entry.createdAt,
          ttlMs: entry.ttlMs,
          schemaVersion: "schema-v1",
          dataVersion: "dv-1",
          specChecksum: "spec-v1",
          cacheNamespace: "ns:v1",
          compressed: false
        })
      });

      const got = await store.get(key);
      return got?.data?.value;
    });

    expect(result).toBe("alpha");
  });

  test("overwrite existing key", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);
      const dbName = `lcp-idb-contract-overwrite-${Date.now()}`;

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      const now = () => 1000;
      const store = new sdk.IndexedDbCacheStore({ dbName, now });
      const key = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "k1",
          payload: { suite: "persistent-store", label: "k1" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );

      const write = async (value: string) => {
        await store.set({
          cache_key: key,
          data: { value },
          metadata: sdk.createCacheMetadata({
            source: "API",
            createdAt: 1000,
            ttlMs: 10000,
            schemaVersion: "schema-v1",
            dataVersion: "dv-1",
            specChecksum: "spec-v1",
            cacheNamespace: "ns:v1",
            compressed: false
          })
        });
      };

      await write("alpha");
      await write("beta");
      const got = await store.get(key);
      return got?.data?.value;
    });

    expect(result).toBe("beta");
  });

  test("delete removes entry", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);
      const dbName = `lcp-idb-contract-delete-${Date.now()}`;

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      const now = () => 1000;
      const store = new sdk.IndexedDbCacheStore({ dbName, now });
      const key = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "k1",
          payload: { suite: "persistent-store", label: "k1" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );

      await store.set({
        cache_key: key,
        data: { value: "alpha" },
        metadata: sdk.createCacheMetadata({
          source: "API",
          createdAt: 1000,
          ttlMs: 10000,
          schemaVersion: "schema-v1",
          dataVersion: "dv-1",
          specChecksum: "spec-v1",
          cacheNamespace: "ns:v1",
          compressed: false
        })
      });
      await store.delete(key);
      const got = await store.get(key);
      return got ?? null;
    });

    expect(result).toBeNull();
  });

  test("clear removes all entries", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);
      const dbName = `lcp-idb-contract-clear-${Date.now()}`;

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      const now = () => 1000;
      const store = new sdk.IndexedDbCacheStore({ dbName, now });

      const write = async (cacheKey: string, value: string) => {
        await store.set({
          cache_key: cacheKey,
          data: { value },
          metadata: sdk.createCacheMetadata({
            source: "API",
            createdAt: 1000,
            ttlMs: 10000,
            schemaVersion: "schema-v1",
            dataVersion: "dv-1",
            specChecksum: "spec-v1",
            cacheNamespace: "ns:v1",
            compressed: false
          })
        });
      };

      const key1 = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "k1",
          payload: { suite: "persistent-store", label: "k1" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );
      const key2 = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "k2",
          payload: { suite: "persistent-store", label: "k2" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );
      await write(key1, "alpha");
      await write(key2, "beta");
      await store.clear();

      const a = await store.get(key1);
      const b = await store.get(key2);
      return { a: a ?? null, b: b ?? null };
    });

    expect(result.a).toBeNull();
    expect(result.b).toBeNull();
  });

  test("pruneExpired removes expired only", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);
      const dbName = `lcp-idb-contract-prune-${Date.now()}`;

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      let nowMs = 1000;
      const now = () => nowMs;
      const store = new sdk.IndexedDbCacheStore({ dbName, now });

      const write = async (cacheKey: string, value: string, createdAt: number, ttlMs: number) => {
        const metadata = sdk.createCacheMetadata({
          source: "API",
          createdAt,
          ttlMs,
          schemaVersion: "schema-v1",
          dataVersion: "dv-1",
          specChecksum: "spec-v1",
          cacheNamespace: "ns:v1",
          compressed: false
        });

        await store.set({
          cache_key: cacheKey,
          data: { value },
          metadata
        });
      };

      const expiredKey = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "expired",
          payload: { suite: "persistent-store", label: "expired" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );
      const validKey = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "valid",
          payload: { suite: "persistent-store", label: "valid" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );
      await write(expiredKey, "old", 0, 100);
      await write(validKey, "new", 1000, 10000);
      nowMs = 5000;

      const removed = await store.pruneExpired();
      const expired = await store.get(expiredKey);
      const valid = await store.get(validKey);

      return {
        removed,
        expired: expired ?? null,
        validValue: valid?.data?.value
      };
    });

    expect(result.removed).toBe(1);
    expect(result.expired).toBeNull();
    expect(result.validValue).toBe("new");
  });

  test("hydrateAllValid excludes expired and respects limit", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);
      const dbName = `lcp-idb-contract-hydrate-${Date.now()}`;

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      let nowMs = 1000;
      const now = () => nowMs;
      const store = new sdk.IndexedDbCacheStore({ dbName, now });

      const write = async (cacheKey: string, value: string, createdAt: number, ttlMs: number) => {
        await store.set({
          cache_key: cacheKey,
          data: { value },
          metadata: sdk.createCacheMetadata({
            source: "API",
            createdAt,
            ttlMs,
            schemaVersion: "schema-v1",
            dataVersion: "dv-1",
            specChecksum: "spec-v1",
            cacheNamespace: "ns:v1",
            compressed: false
          })
        });
      };

      const keyA = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "a",
          payload: { suite: "persistent-store", label: "a" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );
      const keyB = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "b",
          payload: { suite: "persistent-store", label: "b" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );
      const expiredKey = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "expired",
          payload: { suite: "persistent-store", label: "expired" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );
      await write(keyA, "va", 1000, 10000);
      await write(keyB, "vb", 1000, 10000);
      await write(expiredKey, "vx", 0, 100);
      nowMs = 5000;

      const all = await store.hydrateAllValid();
      const keys = all.map((entry: { cache_key: string }) => entry.cache_key).sort((a: string, b: string) => a.localeCompare(b));
      const limited = await store.hydrateAllValid(1);
      return {
        keys,
        expected: [keyA, keyB].sort((a: string, b: string) => a.localeCompare(b)),
        limitedLength: limited.length
      };
    });

    expect(result.keys).toEqual(result.expected);
    expect(result.limitedLength).toBe(1);
  });

  test("set cache value for at least one value in storage", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);
      const dbName = `lcp-idb-contract-visible-${Date.now()}`;

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      const now = () => 1000;
      const store = new sdk.IndexedDbCacheStore({ dbName, now });
      const key = sdk.computeCacheKey(
        {
          namespace: "contract",
          operationId: "visible",
          payload: { suite: "persistent-store", label: "visible" },
          schemaVersion: "v1",
          specChecksum: "spec-v1",
          userScope: "test-user"
        },
        sdk.h57HashFn
      );

      await store.set({
        cache_key: key,
        data: { value: "alpha" },
        metadata: sdk.createCacheMetadata({
          source: "API",
          createdAt: 1000,
          ttlMs: 86400000,
          schemaVersion: "schema-v1",
          dataVersion: "dv-1",
          specChecksum: "spec-v1",
          cacheNamespace: "ns:v1",
          compressed: false
        })
      });

      const got = await store.get(key);
      return got?.data?.value;
    });

    expect(result).toBe("alpha");
  });
});
