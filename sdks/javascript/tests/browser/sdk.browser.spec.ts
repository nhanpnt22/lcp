import { expect, test } from "@playwright/test";

test.describe("LCP SDK browser", () => {
  test("imports SDK ESM bundle in browser", async ({ page }) => {
    await page.goto("/");

    const result = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);
      return {
        hasEngine: typeof sdk.ReadThroughCacheEngine === "function",
        hasMemoryStore: typeof sdk.MemoryCacheStore === "function",
        hasIndexedDbStore: typeof sdk.IndexedDbCacheStore === "function"
      };
    });

    expect(result.hasEngine).toBe(true);
    expect(result.hasMemoryStore).toBe(true);
    expect(result.hasIndexedDbStore).toBe(true);
  });

  test("reads from IndexedDB on second engine instance via browser ESM", async ({ page }) => {
    await page.goto("/");

    const output = await page.evaluate(async () => {
      const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
      const sdk = await import(sdkUrl);

      const dbName = "lcp-playwright-e2e-db";
      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      const now = () => 1000;
      const h57 = (bytes: Uint8Array) =>
        Array.from(bytes)
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");

      const parity = {
        schemaVersion: "schema-v1",
        specChecksum: "spec-v1",
        cacheNamespace: "ns:v1",
        dataVersion: "data-v1"
      };

      let fetchCalls = 0;
      const keyInput = {
        namespace: "ns:v1",
        operationId: "list",
        payload: { id: 123 },
        schemaVersion: "schema-v1",
        specChecksum: "spec-v1",
        userScope: "tenant:alpha"
      };

      const memoryA = new sdk.MemoryCacheStore({ maxEntries: 50, now });
      const idbA = new sdk.IndexedDbCacheStore({ dbName, now });
      const engineA = new sdk.ReadThroughCacheEngine({
        memoryStore: memoryA,
        indexedDbStore: idbA,
        parity,
        now
      });

      const first = await engineA.execute({
        keyInput,
        h57Hash: h57,
        fetchFromApi: async () => {
          fetchCalls++;
          return {
            data: { id: 123, name: "from-api" },
            ttlMs: 3000
          };
        }
      });

      const memoryB = new sdk.MemoryCacheStore({ maxEntries: 50, now });
      const idbB = new sdk.IndexedDbCacheStore({ dbName, now });
      const engineB = new sdk.ReadThroughCacheEngine({
        memoryStore: memoryB,
        indexedDbStore: idbB,
        parity,
        now
      });

      const second = await engineB.execute({
        keyInput,
        h57Hash: h57,
        fetchFromApi: async () => {
          fetchCalls++;
          return {
            data: { id: 123, name: "should-not-run" },
            ttlMs: 3000
          };
        }
      });

      await new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(dbName);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
      });

      return {
        firstSource: first.source,
        secondSource: second.source,
        fetchCalls,
        secondDataName: second.data.name
      };
    });

    expect(output.firstSource).toBe("API");
    expect(output.secondSource).toBe("CACHE");
    expect(output.fetchCalls).toBe(1);
    expect(output.secondDataName).toBe("from-api");
  });
});
