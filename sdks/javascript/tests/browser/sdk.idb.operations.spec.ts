import { expect, test } from "@playwright/test";

test.describe("LCP SDK IndexedDB operations", () => {
  test("set/get/delete/clear/pruneExpired via browser ESM", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);

      const dbName = `lcp-idb-ops-${Date.now()}`;
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      let nowMs = 1000;
      const now = () => nowMs;
      const store = new sdk.IndexedDbCacheStore({ dbName, now });

      const makeEntry = (cacheKey: string, value: string, createdAt: number, ttlMs: number) => ({
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

      // set + get
      await store.set(makeEntry("k1", "value-1", 1000, 5000));
      const gotAfterSet = await store.get("k1");

      // delete
      await store.delete("k1");
      const gotAfterDelete = await store.get("k1");

      // clear
      await store.set(makeEntry("k2", "value-2", 1000, 5000));
      await store.set(makeEntry("k3", "value-3", 1000, 5000));
      await store.clear();
      const hydratedAfterClear = await store.hydrateAllValid();

      // pruneExpired
      await store.set(makeEntry("k4", "expired", 1000, 100));
      await store.set(makeEntry("k5", "valid", 1000, 10000));
      nowMs = 5000;
      const pruneCount = await store.pruneExpired();
      const gotExpiredAfterPrune = await store.get("k4");
      const gotValidAfterPrune = await store.get("k5");

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      return {
        gotAfterSet: gotAfterSet?.data?.value,
        gotAfterDelete: gotAfterDelete ?? null,
        hydratedAfterClearLength: hydratedAfterClear.length,
        pruneCount,
        gotExpiredAfterPrune: gotExpiredAfterPrune ?? null,
        gotValidAfterPrune: gotValidAfterPrune?.data?.value
      };
    });

    expect(result.gotAfterSet).toBe("value-1");
    expect(result.gotAfterDelete).toBeNull();
    expect(result.hydratedAfterClearLength).toBe(0);
    expect(result.pruneCount).toBe(1);
    expect(result.gotExpiredAfterPrune).toBeNull();
    expect(result.gotValidAfterPrune).toBe("valid");
  });
});
