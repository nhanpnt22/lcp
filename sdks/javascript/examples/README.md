# LCP Cache Browser Examples

This folder contains browser examples for integrating the LCP Local Cache SDK with client applications.

## Which Example To Use

- `simple-cache.html`
  - Use for local integration development with a mock API.
  - Best for deterministic testing and AI-assisted coding where no network dependency is desired.
  - Includes a built-in self-test flow (`SELF-TEST PASSED/FAILED`).

- `simple-cache-live.html`
  - Use for live client integration with a real HTTP endpoint via `fetch`.
  - Best for validating API-first then cache-hit behavior in realistic browser conditions.
  - Includes a run-twice check (`PASS: second call served from cache.`).

- `lcp-uat.html`
  - Use for broader UAT validation of cache behavior.
  - Covers keying, TTL behavior, memory/IndexedDB paths, payload sizes, and persistence mode policies.

## Prerequisite

Build the browser bundle before opening HTML examples:

```bash
# from repo root
npm --prefix sdks/javascript run build:min
```

The examples load the SDK from:

- `../min/lcp-local-cache.min.js`

## Quick Run

Open any example directly in browser with a `file://` URL, for example:

- `cache/examples/simple-cache.html`
- `cache/examples/simple-cache-live.html`

## Browser Global API

The minified bundle exposes `window.LcpLocalCache` (same as `globalThis.LcpLocalCache`) as the primary browser global for LCP.
`window.SdalpLocalCache` remains as a legacy-compatible alias. Available members:

- `ReadThroughCacheEngine`
- `createCacheMetadata`
- `isCacheMetadataParityValid`
- `buildCacheKeyMaterial`
- `computeCacheKey`
- `canonicalJSONStringify`
- `CacheSingleFlight`
- `MemoryCacheStore`
- `IndexedDbCacheStore`
- `buildDeterministicEvictionPlan`
- `extractOacTtlMs`
- `evaluateTtl`
- `assertCacheEntryInvariants`
- `InMemoryResumeStateStore`
- `buildResumeHint`
- `buildResumeTokenMaterial`
- `demoHash`

## Integration Contract (AI + Developer)

All examples align on the same read-through contract:

- `ReadThroughCacheEngine.execute({ ... })`
- `keyInput` fields:
  - `namespace`
  - `operationId`
  - `payload`
  - `schemaVersion`
  - `specChecksum`
  - `userScope`
- `fetchFromApi` returns:
  - `{ data, ttlMs }`
- `h57Hash` uses deterministic hash function (`demoHash` in browser examples).
