import { describe, expect, it } from "vitest";
import { validateCacheEntryInvariants } from "../../validation/cache.validation";
import { buildEntry, parityFixture } from "../helpers/fixtures";

describe("validation/cache.validation", () => {
  it("accepts a valid cache entry", () => {
    const entry = buildEntry({ cacheKey: "k1", data: { id: 1, name: "ok" } });

    const result = validateCacheEntryInvariants(entry, {
      parity: {
        schema_version: parityFixture.schemaVersion,
        spec_checksum: parityFixture.specChecksum,
        cache_namespace: parityFixture.cacheNamespace
      },
      expectedCacheKey: "k1",
      requireNoSensitiveData: true,
      requireNoTraceInData: true
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects sensitive fields", () => {
    const entry = buildEntry({ cacheKey: "k2", data: { profile: { access_token: "secret" } } });
    const result = validateCacheEntryInvariants(entry, {
      parity: {
        schema_version: parityFixture.schemaVersion,
        spec_checksum: parityFixture.specChecksum,
        cache_namespace: parityFixture.cacheNamespace
      },
      requireNoSensitiveData: true
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("sensitive fields present");
  });

  it("rejects persisted trace fields", () => {
    const entry = buildEntry({ cacheKey: "k3", data: { nested: { trace_id: "trace-1" } } });
    const result = validateCacheEntryInvariants(entry, {
      parity: {
        schema_version: parityFixture.schemaVersion,
        spec_checksum: parityFixture.specChecksum,
        cache_namespace: parityFixture.cacheNamespace
      },
      requireNoTraceInData: true
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("trace fields");
  });
});
