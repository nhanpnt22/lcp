import * as LcpJsSdk from "./index";

(globalThis as typeof globalThis & { SdalpLocalCache?: unknown }).SdalpLocalCache =
  Object.freeze(LcpJsSdk);
