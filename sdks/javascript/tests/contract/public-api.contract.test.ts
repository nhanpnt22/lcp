import { describe, expect, it } from "vitest";
import * as sdk from "../../index";

describe("public API contract", () => {
  it("exports required runtime symbols from package root", () => {
    expect(typeof sdk.ReadThroughCacheEngine).toBe("function");
    expect(typeof sdk.MemoryCacheStore).toBe("function");
    expect(typeof sdk.CacheSingleFlight).toBe("function");
    expect(typeof sdk.computeCacheKey).toBe("function");
    expect(typeof sdk.extractOacTtlMs).toBe("function");
  });

  it("exports metadata and validation helpers", () => {
    expect(typeof sdk.createCacheMetadata).toBe("function");
    expect(typeof sdk.validateCacheEntryInvariants).toBe("function");
    expect(typeof sdk.assertCacheEntryInvariants).toBe("function");
  });
});
