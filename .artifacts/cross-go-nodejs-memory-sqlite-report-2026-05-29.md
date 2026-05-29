# Cross SDK Report: Go vs NodeJS (Memory + SQLite)

Date: 2026-05-29
Scope: Persistent store function parity and value checks after cache set.

## Test Plan

Backends:
- memory
- sqlite

Function-level cases (run one-by-one):
1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

Validation rules:
- For set/get and overwrite, data value must match expected string payload.
- For delete/clear, subsequent get must return nil/undefined.
- For pruneExpired, exactly one expired entry removed while valid entry remains.
- For hydrateAllValid, expired entries excluded and limit honored.

## Added Contract Tests

Go:
- sdks/go/persistent_store_contract_test.go

NodeJS:
- sdks/nodejs/tests/persistent.store.contract.test.ts

## One-by-One Execution Summary

Go (memory + sqlite per case):
- TestPersistentStoreContractSetGetValue: PASS
- TestPersistentStoreContractOverwrite: PASS
- TestPersistentStoreContractDelete: PASS
- TestPersistentStoreContractClear: PASS
- TestPersistentStoreContractPruneExpired: PASS
- TestPersistentStoreContractHydrateAllValidAndLimit: PASS

NodeJS (memory + sqlite per case):
- set/get value after set: PASS
- overwrite existing key: PASS
- delete removes entry: PASS
- clear removes all entries: PASS
- pruneExpired removes expired only: PASS
- hydrateAllValid excludes expired and respects limit: PASS (after fixing test fixture timestamp)

## Cross-SDK Result

Status: MATCHED for tested persistent-store contract surface in memory and sqlite backends.

Checked value-after-set behavior:
- Go memory/sqlite: PASS
- NodeJS memory/sqlite: PASS

## Notes

- A NodeJS test fixture initially used a non-expired timestamp for hydrateAllValid; this caused a false failure and was corrected.
- Final full-suite verification:
  - Go: go test -run TestPersistentStoreContract -v -> PASS
  - NodeJS: vitest run tests/persistent.store.contract.test.ts -> PASS
