# Flutter SDK Release Test Plan

## Scope

This plan defines minimum and target testing requirements before publishing `lcp_flutter_sdk`.

## Release Tiers

### Patch Release (`x.y.z` where only `z` changes)

- Unit tests: 20 to 40
- Integration tests: 8 to 15
- Contract/API tests: 5 to 10
- Packaging/release checks: 3 to 5

Minimum total: 36 to 70 tests/checks.

### Minor/Major Release

- Unit tests: 50+
- Integration tests: 20+
- Contract/API tests: 12+
- Resilience/negative-path tests: 8+
- Performance regression checks: 3 to 6

Target total: 93 to 140 tests/checks.

## Test Categories

### 1) Unit Tests

Focus on deterministic behavior and protocol invariants at module level.

- key/canonical JSON + deterministic key generation
- ttl expiration semantics and boundary values
- validation payload/metadata rules
- single-flight in-flight dedup semantics
- storage memory and sqlite behaviors
- failure, trace, namespace, compression helpers

### 2) Integration Tests

End-to-end cache flows across modules.

- ReadThroughCacheEngine miss -> fetch -> store -> hit
- stale response with background refresh signal
- persistence read/hydrate flow
- resume/state alignment behavior
- safe fallback behavior on non-authoritative write failures

### 3) Contract/API Tests

Public API compatibility and protocol-level invariants.

- root exports compile and are usable
- deterministic keying invariant
- parity-safe metadata handling invariant
- no-backflow and trace stripping invariant

### 4) Packaging/Release Checks

- `dart analyze`
- `dart test`
- `dart pub publish --dry-run`
- verify package file list and public API docs

## Coverage Gates

- Global minimum: 85% lines/functions
- Critical modules minimum: 90% lines/functions
- Critical modules list:
  - `lib/src/execution/`
  - `lib/src/key/`
  - `lib/src/validation/`
  - `lib/src/ttl/`
  - `lib/src/storage/`

## Flake Policy

- 0 known flaky tests at release cut.
- Required: 3 consecutive green CI runs on main/release branch.

## Release Exit Criteria

Release is allowed only if:

- All mandatory gates pass.
- Coverage thresholds are met.
- No flaky tests are open.
- Dry-run package output is verified.
- Version and changelog are finalized.
