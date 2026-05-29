import { describe, expect, it } from "vitest";
import {
  CacheSingleFlight,
  MemoryCacheStore,
  ReadThroughCacheEngine,
  h57HashFn,
  type ReadThroughRequest
} from "../../index";
import { keyInputFixture, parityFixture } from "../helpers/fixtures";

interface ApiData {
  id: number;
  name: string;
}

function buildRequest(fetchFromApi: () => Promise<{ data: ApiData; ttlMs?: number }>): ReadThroughRequest<ApiData> {
  return {
    keyInput: keyInputFixture,
    h57Hash: h57HashFn,
    fetchFromApi
  };
}

describe("execution/ReadThroughCacheEngine integration", () => {
  it("fills cache on miss and serves cache on subsequent hit", async () => {
    const memoryStore = new MemoryCacheStore<ApiData>({ maxEntries: 100, now: () => 500 });
    const engine = new ReadThroughCacheEngine<ApiData>({
      memoryStore,
      parity: parityFixture,
      now: () => 500
    });

    let calls = 0;
    const request = buildRequest(async () => {
      calls++;
      return { data: { id: 1, name: "alpha" }, ttlMs: 1000 };
    });

    const first = await engine.execute(request);
    const second = await engine.execute(request);

    expect(first.source).toBe("API");
    expect(second.source).toBe("CACHE");
    expect(calls).toBe(1);
  });

  it("bypasses cache when API response has no TTL", async () => {
    const memoryStore = new MemoryCacheStore<ApiData>({ maxEntries: 100, now: () => 1000 });
    const engine = new ReadThroughCacheEngine<ApiData>({
      memoryStore,
      parity: parityFixture,
      now: () => 1000
    });

    let calls = 0;
    const request = buildRequest(async () => {
      calls++;
      return { data: { id: 2, name: "beta" } };
    });

    const first = await engine.execute(request);
    const second = await engine.execute(request);

    expect(first.source).toBe("API");
    expect(second.source).toBe("API");
    expect(calls).toBe(2);
    expect(memoryStore.size()).toBe(0);
  });

  it("deduplicates concurrent misses via single-flight", async () => {
    const memoryStore = new MemoryCacheStore<ApiData>({ maxEntries: 100, now: () => 1000 });
    const engine = new ReadThroughCacheEngine<ApiData>({
      memoryStore,
      singleFlight: new CacheSingleFlight(),
      parity: parityFixture,
      now: () => 1000
    });

    let calls = 0;
    const request = buildRequest(async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 20));
      return { data: { id: 3, name: "gamma" }, ttlMs: 1000 };
    });

    const [a, b] = await Promise.all([engine.execute(request), engine.execute(request)]);

    expect(a.source).toBe("API");
    expect(b.source).toBe("API");
    expect(calls).toBe(1);
  });
});
