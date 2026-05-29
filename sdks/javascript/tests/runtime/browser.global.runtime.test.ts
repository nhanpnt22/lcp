import { describe, expect, it } from "vitest";
import * as sdk from "../../index";
import "../../browser.global.entry";

describe("browser global runtime", () => {
  it("publishes frozen SDK object on globalThis.SdalpLocalCache", () => {
    const globalSdk = (globalThis as typeof globalThis & { SdalpLocalCache?: unknown }).SdalpLocalCache;
    expect(globalSdk).toBeDefined();
    expect(Object.isFrozen(globalSdk)).toBe(true);
    expect(globalSdk).toMatchObject({ ReadThroughCacheEngine: sdk.ReadThroughCacheEngine });
  });
});
