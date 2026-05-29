import * as LcpJsSdk from "./index";

const lcpBrowserGlobal = Object.freeze({ ...LcpJsSdk });

(
  globalThis as typeof globalThis & {
    LcpLocalCache?: unknown;
    SdalpLocalCache?: unknown;
  }
).LcpLocalCache = lcpBrowserGlobal;

// Legacy alias kept for backward compatibility with older integrations.
(
  globalThis as typeof globalThis & {
    LcpLocalCache?: unknown;
    SdalpLocalCache?: unknown;
  }
).SdalpLocalCache = lcpBrowserGlobal;
