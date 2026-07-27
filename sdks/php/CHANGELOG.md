# Changelog

## 1.3.0

- Added `FilePersistentStore`, a local-file cache backend storing one JSON
  entry per file at `<rootDir>/<H57 cache_key>.json`, keyed directly by the
  canonical cache key with no additional hashing. Matches the Go, NodeJS, and
  Flutter file stores: atomic temp-file-plus-rename writes, `hydrateAllValid`
  ordered by cache key ascending, and unreadable or non-`.json` files skipped
  rather than fatal. Works on local disks and Cloud Storage FUSE mounts.
- The PHP SDK now offers two interchangeable persistent backends, `sqlite` and
  `file`, both implementing `PersistentStoreInterface`.
- Reorganized the store tests into a shared contract suite
  (`PersistentStoreContractTestCase`) executed against both backends,
  mirroring `runStoreContractSuite` in the NodeJS SDK, plus backend-specific
  cases for ordering and on-disk layout.

## 1.2.0

- Initial PHP SDK package, scoped to the SQLite persistent store and its
  supporting primitives: `CacheEntry`/`CacheMetadata`, the B57 codec, and
  H57 canonical cache-key validation. See `README.md` for scope details.
