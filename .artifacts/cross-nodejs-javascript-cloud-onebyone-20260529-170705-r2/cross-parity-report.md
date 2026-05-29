# Cross Parity Report: JavaScript (IndexedDB) vs NodeJS (Memory + Cloud Storage)

## Scope
- JavaScript SDK is baseline (primary).
- Cross-test one-by-one across the same six contract cases.
- NodeJS run includes both backends for each case:
  - memory
  - cloud-storage
- Cache key policy: H57 only.

## Test Plan (One-by-One Cases)
1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

## Execution
- Artifacts root: `.artifacts/cross-nodejs-javascript-cloud-onebyone-20260529-170705-r2`
- JavaScript corrected one-by-one results: `js_results.fixed.tsv`
- NodeJS one-by-one results: `node_results.tsv`
- Per-case logs:
  - JavaScript: `js_fixed_*.log`
  - NodeJS: `node_*.log`

## Results Matrix
| Case | JavaScript IndexedDB | NodeJS (memory + cloud) | Match |
|---|---|---|---|
| set/get value after set | PASS | PASS | YES |
| overwrite existing key | PASS | PASS | YES |
| delete removes entry | PASS | PASS | YES |
| clear removes all entries | PASS | PASS | YES |
| pruneExpired removes expired only | PASS | PASS | YES |
| hydrateAllValid excludes expired and respects limit | PASS | PASS | YES |

## Value After Set Verification
- JavaScript asserts retrieved value equals `"alpha"` in the first case.
- NodeJS asserts retrieved value equals `"alpha"` in the first case.

## H57 Cache Key Verification
- JavaScript one-by-one suite computes keys using `computeCacheKey(..., h57HashFn)` in all cases.
- NodeJS one-by-one suite uses `h57Key(...)` -> `computeCacheKey(input, h57HashFn)`.

## Mismatch Decision
- mismatch_count = 0
- No parity mismatch detected.
- No fix required in NodeJS or JavaScript for this one-by-one matrix.

## Notes
- An earlier JavaScript command run failed because Playwright config path was relative to workspace root. The corrected run used absolute Playwright config/spec paths and is the authoritative JS baseline for this report.
