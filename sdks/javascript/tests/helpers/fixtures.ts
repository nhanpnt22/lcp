import { createCacheMetadata, type CacheEntry, type CacheKeyInput } from "../../index";

export const parityFixture = {
  schemaVersion: "schema-v1",
  specChecksum: "spec-v1",
  cacheNamespace: "ns:v1",
  dataVersion: "data-v1"
};

export const keyInputFixture: CacheKeyInput = {
  namespace: "ns:v1",
  operationId: "get-item",
  payload: { id: 1, request_id: "trace-only" },
  schemaVersion: "schema-v1",
  specChecksum: "spec-v1",
  userScope: "tenant:alpha"
};

export function h57Fixture(input: Uint8Array): string {
  return Array.from(input)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildEntry<T>(params: { cacheKey: string; data: T; createdAt?: number; ttlMs?: number }): CacheEntry<T> {
  const createdAt = params.createdAt ?? 100;
  const ttlMs = params.ttlMs ?? 500;
  return {
    cache_key: params.cacheKey,
    data: params.data,
    metadata: createCacheMetadata({
      source: "API",
      createdAt,
      ttlMs,
      schemaVersion: parityFixture.schemaVersion,
      dataVersion: parityFixture.dataVersion,
      specChecksum: parityFixture.specChecksum,
      cacheNamespace: parityFixture.cacheNamespace
    })
  };
}
