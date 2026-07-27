# LCP SDK Parity Matrix

This document tracks feature and module parity across SDKs:

- JavaScript SDK: `sdks/javascript`
- Flutter SDK: `sdks/flutter`
- Go SDK: `sdks/go`
- NodeJS SDK: `sdks/nodejs`
- PHP SDK: `sdks/php` (partial — persistent stores only)

Status key:

- `MATCHED`: Equivalent capability exists in compared SDKs.
- `PLATFORM-SPECIFIC`: Capability differs by runtime/platform design.

Scope note:

- The module and release tables below are the authoritative JavaScript <-> Flutter parity view.
- Go and NodeJS parity are tracked in baseline sections and profile references.

## Module Parity

| Capability | JavaScript SDK | Flutter SDK | Status | Notes |
|---|---|---|---|---|
| Root export surface | `index.ts` | `lib/lcp_flutter_sdk.dart` | MATCHED | Both expose compression, consistency, entry, execution, failure, key, namespace, resume, singleflight, storage, swr, trace, ttl, validation. |
| Compression helpers | `compression/cache.compression.ts` | `lib/src/compression/cache_compression.dart` | MATCHED | Deterministic optional compression/decompression with codec registry. |
| Consistency serializer | `consistency/cache.serializer.ts` | `lib/src/consistency/cache_serializer.dart` | MATCHED | Canonicalization + deterministic serialization available in both. |
| Cache entry + metadata | `entry/cache.entry.ts` | `lib/src/entry/cache_entry.dart` | MATCHED | Metadata parity invariants and cache entry model aligned. |
| Read-through engine | `execution/cache.engine.ts` | `lib/src/execution/read_through_cache_engine.dart` | MATCHED | Memory->persistent->API flow, stale handling, resume alignment, and safe write fallback behavior aligned. |
| Failure classification | `failure/cache.failure.ts` | `lib/src/failure/cache_failure.dart` | MATCHED | Deterministic failure action mapping and API fallback execution helpers in both. |
| Key generation | `key/cache.key.ts` + `key/canonical-json.ts` | `lib/src/key/cache_key.dart` + `lib/src/key/canonical_json.dart` | MATCHED | Deterministic key material and canonical JSON behavior aligned. |
| Namespace isolation | `namespace/cache.namespace.ts` | `lib/src/namespace/cache_namespace.dart` | MATCHED | Scope validation and namespace match guards aligned. |
| Resume helpers | `resume/cache.resume.ts` | `lib/src/resume/cache_resume.dart` | MATCHED | Store/snapshot, deterministic token material, and validated state records aligned. |
| Single-flight | `singleflight/cache.singleflight.ts` | `lib/src/singleflight/cache_single_flight.dart` | MATCHED | Per-cache-key in-flight dedup semantics aligned. |
| Memory store | `storage/cache.store.memory.ts` | `lib/src/storage/memory_cache_store.dart` | MATCHED | TTL-checked get and bounded eviction behavior aligned. |
| Persistent store abstraction | `storage/cache.store.idb.ts` interface usage | `lib/src/storage/persistent_cache_store.dart` | MATCHED | Read/write/delete/clear/prune/hydrate contract exists in both. |
| Persistent store implementation | `storage/cache.store.idb.ts` (IndexedDB) | `lib/src/storage/sqlite_persistent_cache_store.dart` (SQLite) | PLATFORM-SPECIFIC | Runtime-appropriate backend differs by platform; semantics aligned. |
| SWR refresh utility | `swr/cache.swr.ts` | `lib/src/swr/cache_swr.dart` | MATCHED | Non-blocking refresh scheduling with single-flight and optional persistence write. |
| Trace helpers | `trace/cache.trace.ts` | `lib/src/trace/cache_trace.dart` | MATCHED | Context validation, propagation, equality checks, and trace-field stripping aligned. |
| TTL extraction/evaluation | `ttl/cache.ttl.ts` | `lib/src/ttl/cache_ttl.dart` | MATCHED | OAC TTL header extraction and BYPASS/VALID/EXPIRED semantics aligned. |
| Validation invariants | `validation/cache.validation.ts` | `lib/src/validation/cache_validation.dart` | MATCHED | Metadata parity, deterministic serialize checks, sensitive/trace field checks aligned. |

## Release and Documentation Parity

| Area | JavaScript SDK | Flutter SDK | Status | Notes |
|---|---|---|---|---|
| Primary README | `sdks/javascript/README.md` | `sdks/flutter/README.md` | MATCHED | Protocol alignment and release verification sections present in both. |
| Changelog | `sdks/javascript/CHANGELOG.md` | `sdks/flutter/CHANGELOG.md` | MATCHED | Both SDKs now maintain changelog files. |
| Release test plan | `sdks/javascript/TEST_PLAN.md` | `sdks/flutter/TEST_PLAN.md` | MATCHED | Both SDKs have release-gate test plan docs. |

## Test Baseline Snapshot

Current observed green state in local validation:

- Flutter: `dart analyze` and `dart test` passed.
- JavaScript: `npm test` and contract tests passed.

## Ongoing Maintenance Rule

Any new module or protocol behavior added in one SDK should be tracked here and either:

1. implemented in the other SDK, or
2. marked as `PLATFORM-SPECIFIC` with rationale.

## Go SDK Baseline

The Go SDK has been added as a standalone package under `sdks/go`.

- Status: `MATCHED` for core protocol surface (key, entry, execution, failure, namespace, resume, singleflight, storage abstraction, swr, trace, ttl, validation).
- Platform-specific note: persistent implementations include in-memory, sqlite, and cloud-storage modes, with Cloud Run guidance documented in `profiles/go/LCP — Go SDK Profile(Cloud Run).txt`.

## NodeJS SDK Baseline

The NodeJS SDK has been added under `sdks/nodejs`.

- Status: `MATCHED` for core protocol runtime surface through NodeJS integration of key, entry, execution, failure, namespace, resume, singleflight, swr, trace, ttl, and validation modules.
- Platform-specific note: NodeJS persistence backends include in-memory, sqlite, and cloud-storage (`gs://`) with Firebase App Hosting guidance in `profiles/nodejs/LCP — NodeJS SDK Profile(Firebase App Hosting).txt`.

## F57 Dependency Versions

All SDKs derive H57 cache keys from the same upstream F57 implementation
(https://github.com/nhanpnt22/f57), so the pinned versions must stay
behaviorally aligned.

| SDK | Pin | Mechanism |
|---|---|---|
| Go | `v0.3.0-go` | `go.mod` require + `replace` to `implementations/go` |
| NodeJS | `v0.3.1-javascript` | npm git dependency `f57-js` |
| JavaScript | `v0.3.1-javascript` | npm git dependency `f57-js` |
| Flutter | `v0.3.0-dart` | `pubspec.yaml` git dep with `path: implementations/dart` |
| PHP | n/a (vendored port) | `src/Key/B57.php` — no PHP implementation exists upstream |

Notes:

- JavaScript/NodeJS pin `v0.3.1` rather than `v0.3.0` because npm cannot
  install a subdirectory of a git repository, and v0.3.0 moved the JS package
  to `implementations/javascript/` with no manifest at the git root. F57
  v0.3.1 adds that root manifest. Go and Dart tooling both support
  subdirectory paths, so they pin `v0.3.0` directly.
- B57/H57 sources are byte-identical across `v0.1.4`, `v0.3.0`, and `v0.3.1`;
  cache keys are unchanged by these upgrades. F57 v0.3.0's breaking changes
  were confined to ID57/I57, which no LCP SDK uses.

## PHP SDK Baseline (partial — persistent stores only: sqlite + file)

The PHP SDK has been added under `sdks/php`, scoped intentionally to the
SQLite and local-file persistent backends and their supporting primitives —
not full protocol parity. See `sdks/php/README.md` for the exact scope
boundary.

| Capability | PHP SDK | Status | Notes |
|---|---|---|---|
| Cache entry + metadata | `src/Entry/CacheEntry.php` + `CacheMetadata.php` | MATCHED | Same snake_case wire shape as Go/NodeJS/Flutter (`cache_key`, `data`, `metadata.{source,created_at,expires_at,ttl_ms,schema_version,data_version,spec_checksum,cache_namespace,compressed}`). |
| B57 codec | `src/Key/B57.php` | MATCHED | Ported from `github.com/nhanpnt22/f57` (implementations/go/b57.go); no PHP branch exists upstream in that project, so this is a from-source port rather than a Composer dependency, kept dependency-free (no ext-gmp/ext-bcmath). |
| H57 cache-key validation | `src/Key/H57.php` | MATCHED | `isH57CacheKey`/`assertH57CacheKey` mirror `validateH57CacheKey` (Go) / `assertH57CacheKey` (NodeJS, Flutter): canonical-B57 format check only. H57 hash *generation* (BLAKE3-based) is out of scope. |
| Persistent store abstraction | `src/Storage/PersistentStoreInterface.php` | MATCHED | Same six-method contract (`get`/`set`/`delete`/`clear`/`pruneExpired`/`hydrateAllValid`) as `PersistentCacheStore[T]` (Go) / `NodePersistentStore<T>` (NodeJS) / `PersistentCacheStore<T>` (Flutter). |
| SQLite persistent store | `src/Storage/SQLitePersistentStore.php` | MATCHED | Schema/semantics follow the NodeJS/Flutter convention (`cache_entries` table with `cache_key`, `entry_json`, `expires_at`, `updated_at`, indexed on `expires_at`; `hydrateAllValid` ordered `updated_at DESC`; lazy expiry-on-read) rather than Go's simpler key→blob-only schema with app-side TTL filtering — the two backend SDKs (NodeJS, Flutter) were the stronger cross-SDK precedent. |
| File persistent store | `src/Storage/FilePersistentStore.php` | MATCHED | One JSON entry per file at `<rootDir>/<H57 cache_key>.json`, keyed directly by the canonical cache key with no extra hashing, matching `FilePersistentStore` (Go, NodeJS) and `FilePersistentCacheStore` (Flutter): atomic temp-file-plus-rename writes, `hydrateAllValid` ordered by cache key ascending, corrupt/non-`.json` files skipped rather than fatal. |
| Everything else (compression, consistency, execution engine, failure, namespace, resume, singleflight, swr, trace, standalone TTL module, in-memory/cloud-storage stores, env-based backend selection, H57 hash generation) | — | NOT IMPLEMENTED | Out of scope for the PHP package; add here if/when implemented. |
