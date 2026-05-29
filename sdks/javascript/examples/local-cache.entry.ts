import { ReadThroughCacheEngine } from "../execution";
import { createCacheMetadata, isCacheMetadataParityValid } from "../entry";
import { buildCacheKeyMaterial, computeCacheKey, canonicalJSONStringify } from "../key";
import { CacheSingleFlight } from "../singleflight";
import { MemoryCacheStore, IndexedDbCacheStore, buildDeterministicEvictionPlan } from "../storage";
import { extractOacTtlMs, evaluateTtl } from "../ttl";
import { assertCacheEntryInvariants } from "../validation";
import { InMemoryResumeStateStore, buildResumeHint, buildResumeTokenMaterial } from "../resume";

function demoHash(input: Uint8Array): string {
  let h = 2166136261;
  for (const byte of input) {
    h ^= byte;
    h = Math.imul(h, 16777619);
  }
  return `h57-demo-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

const SdalpLocalCacheGlobal = Object.freeze({
  ReadThroughCacheEngine,
  createCacheMetadata,
  isCacheMetadataParityValid,
  buildCacheKeyMaterial,
  computeCacheKey,
  canonicalJSONStringify,
  CacheSingleFlight,
  MemoryCacheStore,
  IndexedDbCacheStore,
  buildDeterministicEvictionPlan,
  extractOacTtlMs,
  evaluateTtl,
  assertCacheEntryInvariants,
  InMemoryResumeStateStore,
  buildResumeHint,
  buildResumeTokenMaterial,
  demoHash
});

(globalThis as typeof globalThis & { SdalpLocalCache?: unknown }).SdalpLocalCache = SdalpLocalCacheGlobal;

export { SdalpLocalCacheGlobal, demoHash };
