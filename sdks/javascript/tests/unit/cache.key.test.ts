import { describe, expect, it } from "vitest";
import { buildCacheKeyMaterial, computeCacheKey } from "../../key/cache.key";
import { h57Fixture } from "../helpers/fixtures";

describe("key/cache.key", () => {
  it("builds deterministic key material and strips trace fields", () => {
    const a = buildCacheKeyMaterial({
      namespace: "ns",
      operationId: "op",
      payload: { id: 42, trace_id: "trace-a", nested: { request_id: "rid-a", value: 1 } },
      schemaVersion: "s1",
      specChecksum: "c1",
      userScope: "u1"
    });

    const b = buildCacheKeyMaterial({
      namespace: "ns",
      operationId: "op",
      payload: { id: 42, trace_id: "trace-b", nested: { request_id: "rid-b", value: 1 } },
      schemaVersion: "s1",
      specChecksum: "c1",
      userScope: "u1"
    });

    expect(a).toBe(b);
  });

  it("computes key via injected h57 hash", () => {
    const key = computeCacheKey(
      {
        namespace: "ns",
        operationId: "op",
        payload: { id: 1 },
        schemaVersion: "s1",
        specChecksum: "c1",
        userScope: "u1"
      },
      h57Fixture
    );

    expect(key).toMatch(/^[0-9a-f]+$/);
    expect(key.length).toBeGreaterThan(10);
  });
});
