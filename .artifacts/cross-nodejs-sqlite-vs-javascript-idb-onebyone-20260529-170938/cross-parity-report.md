# Cross Parity Report: JavaScript IndexedDB vs NodeJS SQLite

## Scope
- Baseline/primary: JavaScript SDK (IndexedDB).
- Candidate: NodeJS SDK (SQLite backend only).
- Policy: cache key must be H57.

## One-by-One Test Plan
1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

## Execution Artifacts
- JavaScript results: `js_results.tsv`
- NodeJS SQLite results: `node_sqlite_results.tsv`
- JavaScript per-case logs: `js_*.log`
- NodeJS SQLite per-case logs: `node_sqlite_*.log`

## Results Matrix
| Case | JavaScript IndexedDB | NodeJS SQLite | Match |
|---|---|---|---|
| set/get value after set | PASS | PASS | YES |
| overwrite existing key | PASS | PASS | YES |
| delete removes entry | PASS | PASS | YES |
| clear removes all entries | PASS | PASS | YES |
| pruneExpired removes expired only | PASS | PASS | YES |
| hydrateAllValid excludes expired and respects limit | PASS | PASS | YES |

## Value-After-Set Check
- JavaScript case verifies returned value is "alpha".
- NodeJS SQLite case verifies returned value is "alpha".

## H57 Verification
- JavaScript one-by-one suite computes keys via `computeCacheKey(..., h57HashFn)`.
- NodeJS SQLite suite uses `h57Key(...)` which returns `computeCacheKey(input, h57HashFn)`.

## Decision (JS Primary)
- mismatch_count = 0
- No mismatch found.
- No NodeJS fix required.
- No JavaScript bug found in this matrix.
