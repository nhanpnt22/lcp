# JavaScript SDK Release Test Plan

## Scope

This plan defines minimum and target testing requirements before publishing `@sdp/lcp-javascript-sdk`.

## Release Tiers

### Patch Release (`x.y.z` where only `z` changes)

- Unit tests: 40 to 70
- Integration tests: 12 to 20
- Contract/API tests: 10 to 15
- Bundle/runtime tests: 6 to 10
- Packaging/release checks: 4 to 6

Minimum total: 72 to 121 tests/checks.

### Minor/Major Release

- Unit tests: 80+
- Integration tests: 25+
- Contract/API tests: 20+
- Bundle/runtime tests: 12+
- Performance regression checks: 5 to 10
- Resilience/negative-path tests: 5 to 10

Target total: 150 to 220 tests/checks.

## Test Categories

### 1) Unit Tests

Focus on deterministic behavior and protocol invariants at module level.

- `key/`: canonical JSON + deterministic key generation
- `ttl/`: expiration semantics and boundary values
- `validation/`: payload/metadata validation rules
- `singleflight/`: in-flight dedup semantics
- `swr/`: staleness handling and callback transitions
- `failure/`: normalized failure codes and mapping
- `storage/cache.store.memory.ts`: read/write/evict primitives

### 2) Integration Tests

End-to-end cache flows across modules.

- `ReadThroughCacheEngine` happy path miss->fetch->store->hit
- stale-but-servable with SWR callback flow
- soft failure paths with safe fallback behavior
- memory store integration
- IndexedDB store integration (`storage/cache.store.idb.ts`)
- namespace partition behavior

### 3) Contract/API Tests

Public API compatibility and protocol-level invariants.

- public exports shape from package root
- backward compatibility of exported symbols
- no-backflow behavior invariant
- parity-safe metadata handling invariant
- deterministic keying invariant

### 4) Bundle/Runtime Tests

Distribution correctness across runtimes.

- ESM import path works
- CJS require path works
- browser global exists as `window.SdalpLocalCache`
- canonical browser bundle filename exists
- version-pinned browser filename exists
- compatibility alias filename exists

### 5) Packaging/Release Checks

- `npm run typecheck`
- `npm run smoke`
- `npm pack --dry-run`
- verify tarball files list contains intended dist artifacts only
- verify `exports` map matches generated outputs

## Coverage Gates

- Global minimum: 85% lines/functions
- Critical modules minimum: 90% lines/functions
- Critical modules list:
  - `execution/`
  - `key/`
  - `validation/`
  - `ttl/`
  - `swr/`
  - `singleflight/`

## Flake Policy

- 0 known flaky tests at release cut.
- Required: 3 consecutive green CI runs on main/release branch.

## CI Gate Matrix

Every release candidate must pass all gates below.

1. Lint/format gate (if configured)
2. Typecheck gate
3. Unit gate
4. Integration gate
5. Contract/API gate
6. Bundle/runtime gate
7. Coverage gate
8. Packaging gate (`npm pack --dry-run`)

## Suggested Execution Order

1. `npm install`
2. `npm run typecheck`
3. Run unit/integration/contract/runtime suites
4. `npm run smoke`
5. `npm pack --dry-run`
6. Publish only after all gates pass

## Release Exit Criteria

Release is allowed only if:

- All mandatory gates pass.
- Coverage thresholds are met.
- No flaky tests are open.
- Tarball output is verified.
- Version and changelog are finalized.