# Cross-SDK One-by-One Parity Report

Date: 2026-05-29
Baseline: JavaScript SDK (IndexedDB via Playwright)
Candidate: NodeJS SDK (memory + cloud-storage)

## Scope

Compared six contract cases one-by-one:

1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

## Execution

NodeJS commands:

- `npm run test -- tests/persistent.store.cloud.contract.test.ts -t "<case>"`

JavaScript commands:

- `npm run build`
- `npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "<case>"`

## Result Matrix

| Case | JavaScript IndexedDB (baseline) | NodeJS memory | NodeJS cloud-storage |
|---|---|---|---|
| set/get value after set | PASS | PASS | PASS |
| overwrite existing key | PASS | PASS | PASS |
| delete removes entry | PASS | PASS | PASS |
| clear removes all entries | PASS | PASS | PASS |
| pruneExpired removes expired only | PASS | PASS | PASS |
| hydrateAllValid excludes expired and respects limit | PASS | PASS | PASS |

## Mismatch Summary

- mismatch_count: 0
- decision: MATCHED

## Fix Applied During Validation

Two test-harness issues were fixed in NodeJS cloud contract tests:

1. Corrected fallback credential path resolution to be relative to the test file directory.
2. Increased per-case timeout to 30000ms to avoid false negatives from cloud latency on `clear`, `pruneExpired`, and `hydrateAllValid`.

No SDK behavior changes were required for parity after these harness fixes.
