# LCP SDK Parity Matrix

This document tracks feature and module parity across SDKs:

- JavaScript SDK: `sdks/javascript`
- Flutter SDK: `sdks/flutter`
- Go SDK: `sdks/go`
- NodeJS SDK: `sdks/nodejs`

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
