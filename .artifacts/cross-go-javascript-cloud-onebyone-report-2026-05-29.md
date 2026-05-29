# Cross SDK One-by-One Report: Go (memory+cloud-storage) vs JavaScript (IndexedDB)

Date: 2026-05-29
Baseline: JavaScript SDK behavior is primary.

## Plan

1. Use one aligned case matrix across SDKs.
2. Run Go one-by-one for each function case with memory and cloud-storage backends.
3. Run JavaScript one-by-one for each function case with IndexedDB backend.
4. Verify value-after-set and function-specific expectations.
5. Compare outcomes; if mismatch, prioritize JS baseline and patch Go unless JS bug is proven.

## Case Matrix

1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

## First Run Outcome

Initial run detected mismatches in Go cloud-storage cases:
- delete removes entry
- clear removes all entries
- pruneExpired removes expired only

Root cause in Go SDK:
- Cloud Storage `Get` treated wrapped object-not-found errors as hard errors instead of cache miss (`nil`).
- Cloud Storage persisted only `data` (legacy behavior), which could degrade metadata semantics for TTL-related flows.

## Fixes Applied (Go)

1. `sdks/go/cloud_storage_persistent_store.go`
- Persist full `CacheEntry` JSON in cloud objects (not only `data`).
- Decode full entry with backward-compatible fallback for legacy data-only payloads.
- Normalize wrapped cloud not-found errors via `isCloudObjectNotFound` and treat as miss in:
  - `Get`
  - `Delete`
  - `Clear`
  - `readAllEntries`

2. Added Go cloud one-by-one contract suite:
- `sdks/go/persistent_store_cloud_contract_test.go`
- Covers all six function cases with backends:
  - memory
  - cloud-storage

3. Added one-command runner:
- `scripts/run_cross_go_javascript_cloud_onebyone.sh`

## Final Run Outcome

Command:
- `LCP_CROSS_GO_JS_SKIP_BUILD=1 ./scripts/run_cross_go_javascript_cloud_onebyone.sh`

Artifacts:
- `.artifacts/cross-go-javascript-cloud-onebyone-20260529-163512/report.md`
- `.artifacts/cross-go-javascript-cloud-onebyone-20260529-163512/report.json`
- `.artifacts/cross-go-javascript-cloud-onebyone-20260529-163512/run.log`

Result:
- All six one-by-one cases PASS for Go (memory+cloud-storage) and JavaScript (IndexedDB).
- Mismatch count: 0
- Status: MATCHED

## Conclusion

The requested cross one-by-one validation for Go (memory+cloud-storage) vs JavaScript (IndexedDB) is complete and matched after fixing Go cloud-storage behavior to align with JavaScript baseline expectations.
