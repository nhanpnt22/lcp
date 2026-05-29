# Changelog Fragment - 2026-05-29

## Summary

Production-grade gate closure for cross-SDK strict H57 enforcement with deterministic drift remediation.

## Fixed

### JavaScript
- Fixed integration test harness drift under strict H57 validation.
- Updated read-through integration tests to use canonical `h57HashFn` instead of non-canonical fixture hashing.
- File: `sdks/javascript/tests/integration/read-through.engine.test.ts`

### Flutter
- Fixed read-through engine test drift under strict H57 validation.
- Updated test hash functions to `h57HashFn` and replaced literal non-H57 cache key with `computeCacheKey(..., h57HashFn)`.
- File: `sdks/flutter/test/read_through_cache_engine_test.dart`

## Validation Evidence

### Go
- `go test ./...` PASS
- `go test -race ./...` PASS

### NodeJS
- `npm --prefix sdks/nodejs run release:check` PASS
  - typecheck PASS
  - tests PASS
  - `npm pack --dry-run` PASS

### JavaScript
- `npm --prefix sdks/javascript run test:release` FAIL (initial drift)
- Drift remediated in integration harness
- `npm --prefix sdks/javascript run test:release` PASS
  - typecheck PASS
  - tests PASS
  - smoke PASS
  - `npm pack --dry-run` PASS

### Flutter
- `dart test` FAIL (initial drift)
- Drift remediated in test harness
- `dart test` PASS

## Impact

- No production runtime behavior expansion.
- Strict canonical H57 expectations now consistently reflected in test harnesses.
- Release gates are green for targeted SDK scopes.

## References

- `docs/teesi/EXECUTION_STATUS_2026-05-29.md`
- `docs/teesi/REF-go-cloud-storage-production-story.md`
- `docs/teesi/REF-nodejs-cloud-storage-production-story.md`
- `docs/teesi/REF-javascript-idb-production-story.md`
- `docs/teesi/REF-flutter-persistent-store-production-story.md`
