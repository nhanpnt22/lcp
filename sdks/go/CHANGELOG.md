# Changelog

## 0.1.2

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
