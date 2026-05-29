export type CacheSource = "API" | "CACHE";

export interface CacheMetadata {
  source: CacheSource;
  created_at: number;
  expires_at: number;
  ttl_ms: number;
  schema_version: string;
  data_version: string;
  spec_checksum: string;
  cache_namespace: string;
  compressed: boolean;
}

export interface CacheEntry<T = unknown> {
  cache_key: string;
  data: T;
  metadata: CacheMetadata;
}

export interface CacheMetadataParityExpectation {
  schema_version: string;
  spec_checksum: string;
  cache_namespace: string;
}

/**
 * Deterministic parity validator for metadata fields required by LCP.
 * Returns false on any mismatch or malformed value.
 */
export function isCacheMetadataParityValid(
  metadata: CacheMetadata,
  expected: CacheMetadataParityExpectation
): boolean {
  if (!metadata) return false;

  if (metadata.schema_version !== expected.schema_version) return false;
  if (metadata.spec_checksum !== expected.spec_checksum) return false;
  if (metadata.cache_namespace !== expected.cache_namespace) return false;

  if (metadata.source !== "API" && metadata.source !== "CACHE") return false;
  if (!Number.isFinite(metadata.created_at) || metadata.created_at < 0) return false;
  if (!Number.isFinite(metadata.expires_at) || metadata.expires_at < 0) return false;
  if (!Number.isFinite(metadata.ttl_ms) || metadata.ttl_ms < 0) return false;
  if (metadata.expires_at !== metadata.created_at + metadata.ttl_ms) return false;
  if (!metadata.data_version) return false;

  return true;
}

/**
 * Build immutable metadata from API-authoritative TTL.
 */
export function createCacheMetadata(input: {
  source: CacheSource;
  createdAt: number;
  ttlMs: number;
  schemaVersion: string;
  dataVersion: string;
  specChecksum: string;
  cacheNamespace: string;
  compressed?: boolean;
}): CacheMetadata {
  const expiresAt = input.createdAt + input.ttlMs;
  return Object.freeze({
    source: input.source,
    created_at: input.createdAt,
    expires_at: expiresAt,
    ttl_ms: input.ttlMs,
    schema_version: input.schemaVersion,
    data_version: input.dataVersion,
    spec_checksum: input.specChecksum,
    cache_namespace: input.cacheNamespace,
    compressed: Boolean(input.compressed)
  });
}
