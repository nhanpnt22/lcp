# Changelog

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
