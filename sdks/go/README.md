# LCP Go SDK

Deterministic Local Cache Protocol (LCP) SDK for Go services.

## Scope

This SDK implements LCP `v1.0.0` as a non-authoritative read-through cache layer.

Key capabilities:
- deterministic cache key material and hashing
- memory-first read-through engine
- in-memory persistent store support
- SQLite persistent store support
- direct Cloud Storage persistent store support
- optional single-flight dedup per cache key
- strict metadata parity validation
- resume state helpers and trace-safe key material handling

## Install

```bash
go get github.com/nhanpnt22/lcp/sdks/go
```

## Quick Start

```go
store := lcp.NewMemoryCacheStore[map[string]any](128, time.Now().UnixMilli)
engine := lcp.NewReadThroughCacheEngine(
    store,
    lcp.CacheParity{
        SchemaVersion:  "v1",
        DataVersion:    "v1",
        SpecChecksum:   "spec",
        CacheNamespace: "profile",
    },
)
```

## Cloud Storage Persistent Store

Use the direct Cloud Storage persistent store with a `gs://` URI.

```go
memory := lcp.NewMemoryCacheStore[map[string]any](128, time.Now().UnixMilli)
store, err := lcp.NewCloudStoragePersistentStoreFromURI[map[string]any](
    "gs://aiptesting.firebasestorage.app/lcp",
    lcp.CloudStoragePersistentStoreOptions{},
)
if err != nil {
    panic(err)
}

engine := lcp.NewReadThroughCacheEngine(
    memory,
    lcp.CacheParity{
        SchemaVersion:  "v1",
        DataVersion:    "v1",
        SpecChecksum:   "spec",
        CacheNamespace: "profile",
    },
    lcp.WithPersistentStore[map[string]any](store),
)
_ = engine
```

Notes for cloud-storage:
- persistent objects are stored directly through Cloud Storage APIs
- set `CloudStoragePersistentStoreOptions.CredentialsFile` for service-account auth when needed
- `CloudStoragePersistentStoreOptions.ProjectID` is only applied when `CloudStoragePersistentStoreOptions.EnableUserProject` is true
- `EnableUserProject=true` requires a non-empty `ProjectID`
- keep `EnableUserProject=false` unless you explicitly need requester-pays/user-project billing behavior
- keep cache entries non-authoritative and replay-safe per LCP invariants
- object filenames are treated as cache keys and must be canonical H57
- list-based reads fail fast on invalid filenames or corrupt payloads to avoid silent data drift
- call `store.Close()` during shutdown to release the underlying Cloud Storage client

## Cloud Run Deployment Patterns

This SDK targets Cloud Run with two supported persistent modes:
- in-memory mode via `NewInMemoryPersistentStore`
- storage mode via `NewCloudRunPersistentStore(..., "sqlite"|"cloud-storage", opts)`

Pattern A: in-memory only

- use `NewInMemoryPersistentStore` for process-local persistence
- recommended for fastest access and non-durable cache semantics

Pattern B: SQLite storage

- use a writable SQLite path (for example `/tmp/lcp/lcp_cache.db`)
- select `LCP_STORAGE_BACKEND=sqlite` with `LCP_CLOUD_RUN_BACKEND_PREFERENCE=storage`

Pattern C: Cloud Storage storage

- set `LCP_STORAGE_BACKEND=cloud-storage`
- set `LCP_STORAGE_GCS_URI=gs://<bucket>/<prefix>`
- provide `GOOGLE_CLOUD_PROJECT` and credentials when runtime identity is not sufficient
- set `LCP_STORAGE_GCS_USE_USER_PROJECT=true` only when you intentionally need UserProject/requester-pays behavior

Integration test profiles:

- baseline cloud-storage profile:
    - `LCP_CLOUD_STORAGE_INTEGRATION=1`
    - `LCP_STORAGE_GCS_URI=gs://<bucket>/<prefix>`
- requester-pays/user-project profile:
    - `LCP_CLOUD_STORAGE_INTEGRATION_USER_PROJECT=1`
    - `LCP_STORAGE_GCS_URI=gs://<bucket>/<prefix>`
    - `GOOGLE_CLOUD_PROJECT=<project-id>`
    - `LCP_STORAGE_GCS_USE_USER_PROJECT=true`

## Environment-Based Store Switching

Use `NewPersistentStoreFromEnv` to select a persistent backend at runtime.

Supported runtime modes:
- `local`
- `cloud-run`

Supported backends:
- Local: `in-memory`, `sqlite`, `cloud-storage`
- Cloud Run backend split:
- in-memory: `in-memory`
- storage: `sqlite`, `cloud-storage`

Example:

```go
store, cfg, err := lcp.NewPersistentStoreFromEnv[map[string]any]()
if err != nil {
        panic(err)
}
_ = cfg
_ = store
```

Important behavior:
- when `LCP_RUNTIME_MODE=cloud-run`, backend selection is resolved from:
    `LCP_CLOUD_RUN_BACKEND_PREFERENCE` (`in-memory` or `storage`),
    `LCP_IN_MEMORY_BACKEND`, and `LCP_STORAGE_BACKEND`
- when preference is `in-memory`, backend resolves to `in-memory`
- when preference is `storage`, backend resolves to `sqlite` or `cloud-storage`

General path model:
- `LCP_CACHE_PATH` sets one shared cache subpath (default: `lcp`)
- `LCP_LOCAL_CACHE_ROOT` sets the local base directory (default: `./config`)
- if `LCP_SQLITE_PATH` is unset, default becomes
    `{LCP_LOCAL_CACHE_ROOT}/{LCP_CACHE_PATH}/lcp_cache.db`
- if `LCP_STORAGE_GCS_URI` is unset and `LCP_STORAGE_BUCKET_URI` is set,
    URI defaults to `{LCP_STORAGE_BUCKET_URI}/{LCP_CACHE_PATH}`

## Release Gates

- `go test ./...`
- `go test -race ./...`
- `go vet ./...`
- `go test -coverprofile=coverage.out ./...` (minimum total coverage: `65%`)
