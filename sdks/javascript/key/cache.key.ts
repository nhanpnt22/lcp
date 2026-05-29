import { canonicalJSONStringify } from "./canonical-json";
import { stripTraceFields } from "../trace";

export interface CacheKeyInput {
  namespace: string;
  operationId: string;
  payload: unknown;
  schemaVersion: string;
  specChecksum: string;
  userScope: string;
}

export type H57HashFunction = (input: Uint8Array) => string;

const textEncoder = new TextEncoder();

/**
 * Build deterministic material for H57 input.
 *
 * This is intentionally strict and stable because cache_key identity is
 * a system-law invariant and must be replay-safe.
 */
export function buildCacheKeyMaterial(input: CacheKeyInput): string {
  const canonicalPayload = canonicalJSONStringify(stripTraceFields(input.payload));
  return [
    input.namespace,
    input.operationId,
    canonicalPayload,
    input.schemaVersion,
    input.specChecksum,
    input.userScope
  ].join("|");
}

/**
 * Computes cache_key via injected H57 implementation.
 *
 * Caller should supply F57 H57 implementation from:
 * - https://github.com/nhanpnt22/f57/tree/main/implementations/javascript
 * - https://github.com/nhanpnt22/f57/tree/main/implementations/ts
 */
export function computeCacheKey(input: CacheKeyInput, h57Hash: H57HashFunction): string {
  const material = buildCacheKeyMaterial(input);
  return h57Hash(textEncoder.encode(material));
}
