# Changelog

## 1.2.0

- Initial PHP SDK package, scoped to the persistent-storage layer and its
  supporting primitives: `CacheEntry`/`CacheMetadata`/`CacheSource`, the B57
  codec, and H57 canonical cache-key validation. See `README.md` for scope
  details.
- Two interchangeable persistent backends, both implementing
  `PersistentStoreInterface`:
  - `SQLitePersistentStore` (PDO SQLite) — `cache_entries` table with
    `cache_key`, `entry_json`, `expires_at`, `updated_at`, indexed on
    `expires_at`; `hydrateAllValid` ordered by `updated_at DESC`.
  - `FilePersistentStore` — one JSON entry per file at
    `<rootDir>/<H57 cache_key>.json`, keyed directly by the canonical cache
    key with no additional hashing; atomic temp-file-plus-rename writes;
    `hydrateAllValid` ordered by cache key ascending; unreadable or
    non-`.json` files skipped rather than fatal. Works on local disks and
    Cloud Storage FUSE mounts.
- Both backends apply the same TTL semantics (expired once
  `now >= metadata.expires_at`) and lazily delete an expired entry on read,
  matching the Go, NodeJS, and Flutter stores.
- Store behavior is verified by a shared contract suite
  (`PersistentStoreContractTestCase`) executed against both backends,
  mirroring `runStoreContractSuite` in the NodeJS SDK, plus backend-specific
  cases for ordering and on-disk layout.
