# Changelog

## 1.2.0

- Upgraded the F57 dependency to `v0.3.0-dart` (from the deleted `v0.1.4-dart` tag). The old tag no longer exists upstream, so `dart pub get` could not resolve it on a clean checkout.
- No cache-key or wire-format change: F57's B57/H57 sources are byte-identical between `v0.1.4` and `v0.3.0`. The v0.3.0 breaking changes were confined to ID57/I57, which this SDK does not use.

## 1.1.0

- Added `FilePersistentCacheStore` for JSON-file-based local cache persistence, keyed directly by the canonical H57 `cache_key` (dart:io, non-web).
- Added file store unit tests and a File vs SQLite benchmark script.

## 1.0.0

- Added `SqlitePersistentCacheStore` for durable local cache persistence.
- Added SQLite-backed unit tests for round-trip, expiry pruning, and hydrate limits.
- Refactored SQLite store runtime integration to `sqflite_common` with injected database factory/path resolver for Dart VM testability.

## 0.1.0

- Initial standalone Flutter-compatible LCP SDK package scaffold.
- Added deterministic read-through cache engine.
- Added cache key material, canonical JSON serializer, and validation helpers.
- Added in-memory store and persistent store abstraction.
- Added single-flight utility and resume/state helpers.
- Added baseline unit tests.
