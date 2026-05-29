# Cross SDK One-by-One Report: Go vs JavaScript

Date: 2026-05-29

Primary baseline: JavaScript SDK (IndexedDB behavior is the reference unless a JS bug is identified).

## Plan and Case Matrix

Function cases executed one-by-one:
1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

Backend mapping:
- Go: memory + sqlite (both validated for every case)
- JavaScript: IndexedDB (browser runtime)

Validation expectations per case:
- value after set must match expected payload
- post-delete and post-clear reads must be empty
- pruneExpired removes only expired entries
- hydrateAllValid excludes expired entries and honors limit

## Execution Detail

Go one-by-one commands executed:
- go test -run TestPersistentStoreContractSetGetValue -v
- go test -run TestPersistentStoreContractOverwrite -v
- go test -run TestPersistentStoreContractDelete -v
- go test -run TestPersistentStoreContractClear -v
- go test -run TestPersistentStoreContractPruneExpired -v
- go test -run TestPersistentStoreContractHydrateAllValidAndLimit -v

Result:
- All 6 cases PASS
- Each case passed for both memory and sqlite subtests

JavaScript one-by-one commands executed (Playwright):
- npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "set/get value after set"
- npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "overwrite existing key"
- npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "delete removes entry"
- npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "clear removes all entries"
- npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "pruneExpired removes expired only"
- npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "hydrateAllValid excludes expired and respects limit"

Result:
- All 6 cases PASS in IndexedDB browser runtime
- Full suite re-run: 6/6 PASS

## Cross Comparison Outcome

Case-by-case status (Go memory + Go sqlite vs JS IndexedDB):
- set/get value after set: MATCHED
- overwrite existing key: MATCHED
- delete removes entry: MATCHED
- clear removes all entries: MATCHED
- pruneExpired removes expired only: MATCHED
- hydrateAllValid excludes expired and respects limit: MATCHED

Mismatch count: 0

## Fix Decision

No mismatch was observed.
- No Go fix required.
- No JavaScript fix required.

## Files Added for This Validation

- sdks/javascript/tests/browser/sdk.idb.contract.onebyone.spec.ts
