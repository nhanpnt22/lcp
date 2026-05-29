import { describe, expect, it } from "vitest";
import { evaluateTtl, extractOacTtlMs, OAC_TTL_HEADER } from "../../ttl/cache.ttl";

describe("ttl/cache.ttl", () => {
  it("extracts TTL from case-insensitive object headers", () => {
    const ttl = extractOacTtlMs({ [OAC_TTL_HEADER.toUpperCase()]: "1200" });
    expect(ttl).toBe(1200);
  });

  it("returns undefined for invalid TTL", () => {
    expect(extractOacTtlMs({ [OAC_TTL_HEADER]: "-10" })).toBeUndefined();
    expect(extractOacTtlMs({ [OAC_TTL_HEADER]: "abc" })).toBeUndefined();
  });

  it("evaluates VALID, EXPIRED, and BYPASS states", () => {
    expect(evaluateTtl({ createdAt: 100, now: 150, ttlMs: 100 }).status).toBe("VALID");
    expect(evaluateTtl({ createdAt: 100, now: 250, ttlMs: 100 }).status).toBe("EXPIRED");
    expect(evaluateTtl({ createdAt: 100, now: 150 }).status).toBe("BYPASS");
  });
});
