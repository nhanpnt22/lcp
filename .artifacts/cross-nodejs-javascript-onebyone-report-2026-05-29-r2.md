# Cross SDK One-by-One Report (R2): NodeJS vs JavaScript

Date: 2026-05-29
Baseline: JavaScript SDK is primary and authoritative.

## Plan

1. Define shared one-by-one function matrix.
2. Run NodeJS one-by-one with memory + sqlite backends.
3. Run JavaScript one-by-one with IndexedDB backend.
4. Verify value-after-set and operation outcomes in each case.
5. Compare outcomes against JavaScript baseline and decide fixes.

## Test Cases

1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

## NodeJS One-by-One Run

Command:

```bash
cd sdks/nodejs
cases=(
  'set/get value after set'
  'overwrite existing key'
  'delete removes entry'
  'clear removes all entries'
  'pruneExpired removes expired only'
  'hydrateAllValid excludes expired and respects limit'
)
for c in "${cases[@]}"; do
  npm run test -- -t "$c"
done
```

Result per case:
- set/get value after set: PASS (memory + sqlite)
- overwrite existing key: PASS (memory + sqlite)
- delete removes entry: PASS (memory + sqlite)
- clear removes all entries: PASS (memory + sqlite)
- pruneExpired removes expired only: PASS (memory + sqlite)
- hydrateAllValid excludes expired and respects limit: PASS (memory + sqlite)

## JavaScript One-by-One Run

Command:

```bash
cd sdks/javascript
cases=(
  'set/get value after set'
  'overwrite existing key'
  'delete removes entry'
  'clear removes all entries'
  'pruneExpired removes expired only'
  'hydrateAllValid excludes expired and respects limit'
)
for c in "${cases[@]}"; do
  npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "$c"
done
```

Result per case:
- set/get value after set: PASS
- overwrite existing key: PASS
- delete removes entry: PASS
- clear removes all entries: PASS
- pruneExpired removes expired only: PASS
- hydrateAllValid excludes expired and respects limit: PASS

## Cross Comparison

- Status: MATCHED
- Mismatch count: 0
- Fail count: 0

## Decision

- No mismatch detected against JavaScript baseline.
- No NodeJS fix required.
- No JavaScript fix required.
