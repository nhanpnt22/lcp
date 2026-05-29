# Cross SDK One-by-One Report: Flutter vs JavaScript

Date: 2026-05-29
Baseline: JavaScript SDK (IndexedDB) is primary.

## Plan

1. Use the shared one-by-one function matrix.
2. Run Flutter one-by-one per function case with backends:
   - memory (test adapter implementing PersistentCacheStore)
   - sqlite (SqlitePersistentCacheStore)
3. Run JavaScript one-by-one per function case with IndexedDB browser store.
4. Validate value-after-set and operation expectations per case.
5. Compare with JavaScript baseline and patch Flutter only if mismatch indicates Flutter defect.

## Case Matrix

1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

## Flutter One-by-One Execution

Command pattern used:

```bash
flutter test test/persistent_store_contract_test.dart --plain-name "<case name>"
```

Observed results:
- set/get value after set: PASS
- overwrite existing key: PASS
- delete removes entry: PASS
- clear removes all entries: PASS
- pruneExpired removes expired only: PASS
- hydrateAllValid excludes expired and respects limit: PASS

## JavaScript One-by-One Execution

Command pattern used:

```bash
npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "<case name>"
```

Observed results:
- set/get value after set: PASS
- overwrite existing key: PASS
- delete removes entry: PASS
- clear removes all entries: PASS
- pruneExpired removes expired only: PASS
- hydrateAllValid excludes expired and respects limit: PASS

## Cross Comparison Summary

- Mismatch count: 0
- Status: MATCHED
- Baseline decision: JavaScript behavior accepted; no Flutter fix required.

## Files Added

- sdks/flutter/test/persistent_store_contract_test.dart
