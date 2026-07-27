# Changelog

## 1.2.0

- Upgraded the F57 dependency to `v0.3.0-go` (from `v0.1.4-go`), refreshing the `replace` directive to the current upstream commit. The previous `v0.1.4-*` tags were deleted upstream; the Go module still resolved because Go pins by commit hash, but the pin was stale.
- No cache-key or wire-format change: F57's B57/H57 sources are byte-identical between `v0.1.4` and `v0.3.0`, so previously written cache entries remain readable. The v0.3.0 breaking changes were confined to ID57/I57, which this SDK does not use.

## 1.1.0

- `FilePersistentStore` now writes JSON entries keyed directly by the canonical H57 `cache_key` (no SHA-256 filename hashing), matching the Node.js and Flutter SDKs.
- Added `file` as a selectable `LCP_LOCAL_BACKEND` value, with `LCP_FILE_CACHE_ROOT` controlling the on-disk root.
- Added File vs SQLite vs Cloud Storage benchmarks (`*_bench_test.go`).

## 1.0.0

- Finalized persistent backend matrix to:
	- in-memory: `in-memory`
	- storage: `sqlite` or `cloud-storage`
- Removed Cloud Storage FUSE/file/volume/off backend paths from environment config.
- Refactored `NewCloudRunPersistentStore` to support `in-memory`, `sqlite`, and `cloud-storage` modes.
- Updated testing env profiles and integration tests to use direct cloud-storage backend.
- Updated README and test plan to reflect direct cloud-storage behavior.

## 0.1.1

- Added `FilePersistentStore` for deterministic JSON file caching.
- Added compatibility guidance for Cloud Storage FUSE mount paths on Cloud Run.
- Added file store tests covering round-trip, prune, and hydrate limits.
- Added `NewCloudRunPersistentStore` helper for `in-memory` and `file` modes.

## 0.1.0

- Initial standalone Go SDK scaffold for LCP.
- Added deterministic keying, metadata/validation, and TTL helpers.
- Added read-through cache engine with optional single-flight + persistence hooks.
- Added resume/trace-safe helpers and baseline unit tests.
