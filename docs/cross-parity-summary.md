# Cross Parity Summary

## Scope
- Baseline SDK: JavaScript IndexedDB
- Comparison SDK: NodeJS memory and SQLite
- Additional hardening: Go cloud-storage strict H57 filename enforcement
- Policy: cache keys must be canonical H57 values

## One-By-One Test Plan
1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit
7. set cache value for at least one value in storage

## Results
- JavaScript IndexedDB: 7/7 PASS
- NodeJS memory + SQLite: 7/7 PASS
- NodeJS vs JavaScript mismatches: 0
- Go memory: 7/7 PASS
- Go cloud-storage: 7/7 PASS
 - Flutter memory + SQLite: 7/7 PASS

## Value-After-Set Check
- JavaScript asserts the first case returns `alpha` after set.
- NodeJS asserts the first case returns `alpha` after set.
- Go asserts the first case returns `alpha` after set.

## Storage Evidence Case
- The seventh case proves at least one H57 cache value is stored and readable in both suites.
- JavaScript stores and reads back `alpha` from IndexedDB.
- NodeJS stores and reads back `alpha` from memory and SQLite.
- Go stores and reads back `alpha` from cloud storage and also leaves a visible manual object for console inspection.

## Visible Cloud Storage Evidence
- A stable H57 object was written and left in the bucket under `gs://aiptesting.firebasestorage.app/lcp/manual-visible/`.
- The visible object key is `hdfAdngdcqa4p1X4WZ9bMLfM7WeynwxKygNXbwSQTztD`.

## H57 Enforcement
- JavaScript one-by-one suite computes keys with `computeCacheKey(..., h57HashFn)`.
- NodeJS uses the same H57 key derivation path for all contract cases.
- NodeJS cloud-storage now validates object filenames during list-based reads and throws on non-H57 names.
- Go cloud-storage now does the same and has a regression test that rejects non-H57 filenames.

## Strict Filename Behavior
- Non-H57 cloud object filenames are invalid.
- Cloud filename and cache key are required to match the canonical H57 cache key.
- List-based cloud operations now fail explicitly instead of silently accepting or skipping invalid filenames.

## Validation Completed
- JavaScript one-by-one suite executed successfully.
- NodeJS memory + SQLite contract suite passed on the same seven-case matrix.
- Go cloud contract suite passed after the strict filename enforcement change.
 - Flutter persistent store contract suite passed on the same seven-case matrix.
- The manual visible cloud object was written successfully for storage inspection.

## Key References
- JavaScript one-by-one suite: [sdks/javascript/tests/browser/sdk.idb.contract.onebyone.spec.ts](../sdks/javascript/tests/browser/sdk.idb.contract.onebyone.spec.ts)
- NodeJS cloud contract suite: [sdks/nodejs/tests/persistent.store.cloud.contract.test.ts](../sdks/nodejs/tests/persistent.store.cloud.contract.test.ts)
- NodeJS cloud store: [sdks/nodejs/src/stores/cloud.storage.persistent.store.ts](../sdks/nodejs/src/stores/cloud.storage.persistent.store.ts)
- Go cloud store: [sdks/go/cloud_storage_persistent_store.go](../sdks/go/cloud_storage_persistent_store.go)
- Go cloud contract suite: [sdks/go/persistent_store_cloud_contract_test.go](../sdks/go/persistent_store_cloud_contract_test.go)

## Outcome
- JS remains the primary baseline.
- No parity bug was found in the one-by-one matrix.
- H57 cache key policy is now enforced consistently across the tested cloud and local store paths.