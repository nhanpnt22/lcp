import { describe, expect, it } from "vitest";
import * as sdk from "../../index";
import "../../browser.global.entry";

describe("browser global runtime", () => {
  it("publishes frozen LCP SDK object on globalThis.LcpLocalCache", () => {
    const primaryGlobalSdk = (
      globalThis as typeof globalThis & {
        LcpLocalCache?: unknown;
        SdalpLocalCache?: unknown;
      }
    ).LcpLocalCache;

    const legacyGlobalSdk = (
      globalThis as typeof globalThis & {
        LcpLocalCache?: unknown;
        SdalpLocalCache?: unknown;
      }
    ).SdalpLocalCache;

    expect(primaryGlobalSdk).toBeDefined();
    expect(Object.isFrozen(primaryGlobalSdk)).toBe(true);
    expect(primaryGlobalSdk).toMatchObject({ ReadThroughCacheEngine: sdk.ReadThroughCacheEngine });
    expect(legacyGlobalSdk).toBe(primaryGlobalSdk);
  });
});
