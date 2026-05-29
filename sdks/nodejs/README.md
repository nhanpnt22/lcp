# LCP NodeJS SDK (Firebase App Hosting)

NodeJS runtime SDK for LCP v1.0.0 with Firebase App Hosting-oriented storage support.

## Features

- Read-through cache engine with deterministic keying and parity validation
- Persistence modes: `auto`, `memory-only`, `dual`
- Persistent backends:
  - `in-memory`
  - `sqlite`
  - `cloud-storage` (`gs://` URI)
- Environment-based backend selection via `createNodePersistentStoreFromEnv`

## Install

```bash
npm install @sdp/lcp-nodejs-sdk
```

## Quick Start

```ts
import {
  MemoryCacheStore,
  createNodeReadThroughCacheEngine,
  createNodePersistentStoreFromEnv
} from "@sdp/lcp-nodejs-sdk";

const memoryStore = new MemoryCacheStore({ maxEntries: 1000 });
const { store, config } = createNodePersistentStoreFromEnv();

const engine = createNodeReadThroughCacheEngine({
  memoryStore,
  persistentStore: store,
  parity: {
    schemaVersion: "schema-v1",
    dataVersion: "dv-1",
    specChecksum: "spec-v1",
    cacheNamespace: "ns-v1"
  },
  persistence: {
    mode: config.persistenceMode,
    shortThresholdMs: config.shortThresholdMs
  }
});
```

## End-to-End Example (Firebase App Hosting)

- Example file: `examples/firebase-app-hosting.entry.ts`
- Env template: `.env.example`

Run example:

```bash
node --experimental-strip-types sdks/nodejs/examples/firebase-app-hosting.entry.ts user-001
```

The example:

- loads backend/runtime from env via `createNodePersistentStoreFromEnv`
- creates a `ReadThroughCacheEngine` with deterministic parity fields
- executes a cached `getProfileCached(userId)` call
- prints backend selection and cache result source (`API` or `CACHE`)

## Environment Variables

- `LCP_PERSISTENT_ENABLED=true|false`
- `LCP_RUNTIME_MODE=local|cloud-run`
- `LCP_LOCAL_BACKEND=in-memory|sqlite|cloud-storage`
- `LCP_CLOUD_RUN_BACKEND_PREFERENCE=in-memory|storage`
- `LCP_IN_MEMORY_BACKEND=in-memory`
- `LCP_STORAGE_BACKEND=sqlite|cloud-storage`
- `LCP_SQLITE_PATH=/tmp/lcp/lcp_cache.db`
- `LCP_STORAGE_GCS_URI=gs://bucket/lcp`
- `LCP_STORAGE_BUCKET_URI=gs://bucket`
- `LCP_PERSISTENCE_MODE=auto|memory-only|dual`
- `LCP_PERSISTENCE_SHORT_THRESHOLD_MS=300000`
- `GOOGLE_CLOUD_PROJECT=...`
- `LCP_STORAGE_GCS_USE_USER_PROJECT=true|false` (default `false`; requires `GOOGLE_CLOUD_PROJECT` when `true`)
- `GCP_SA_KEY=/path/to/key.json`

Cloud-storage production notes:

- object filenames are treated as canonical H57 cache keys
- hydrate/prune fail fast when object filename is non-H57, payload is invalid JSON, or payload key does not match filename
- keep `LCP_STORAGE_GCS_USE_USER_PROJECT=false` unless requester-pays/UserProject billing is intentionally required

## Verification

```bash
npm run typecheck
npm run test
npm run release:check
```
