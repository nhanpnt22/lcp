# Cross SDK One-by-One Report: NodeJS vs JavaScript

Date: 2026-05-29
Baseline: JavaScript SDK (IndexedDB) is primary.

Context note:
- The request text mentioned "Flutter SDK vs Javascript SDK" but the action/expectation explicitly required NodeJS behavior and NodeJS fixes.
- This run executed NodeJS vs JavaScript accordingly.

## Plan

1. Use one shared function-case matrix.
2. Run NodeJS one-by-one for each case across memory and sqlite backends.
3. Run JavaScript one-by-one for each case in IndexedDB browser runtime.
4. Validate value-after-set and each operation expectation.
5. Compare with JavaScript as source-of-truth; fix NodeJS if mismatches appear unless issue is proven in JavaScript.

## Case Matrix

1. set/get value after set
2. overwrite existing key
3. delete removes entry
4. clear removes all entries
5. pruneExpired removes expired only
6. hydrateAllValid excludes expired and respects limit

## NodeJS One-by-One Execution

Command used:

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

Observed results:
- set/get value after set: PASS (memory + sqlite)
- overwrite existing key: PASS (memory + sqlite)
- delete removes entry: PASS (memory + sqlite)
- clear removes all entries: PASS (memory + sqlite)
- pruneExpired removes expired only: PASS (memory + sqlite)
- hydrateAllValid excludes expired and respects limit: PASS (memory + sqlite)

## JavaScript One-by-One Execution

Command used:

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

Observed results:
- set/get value after set: PASS
- overwrite existing key: PASS
- delete removes entry: PASS
- clear removes all entries: PASS
- pruneExpired removes expired only: PASS
- hydrateAllValid excludes expired and respects limit: PASS

## Cross Comparison Outcome

- Status: MATCHED
- Mismatch count: 0
- Fail count: 0

Per-case cross status:
- set/get value after set: MATCHED
- overwrite existing key: MATCHED
- delete removes entry: MATCHED
- clear removes all entries: MATCHED
- pruneExpired removes expired only: MATCHED
- hydrateAllValid excludes expired and respects limit: MATCHED

## Fix Decision

- No mismatch observed.
- No NodeJS or JavaScript fix required for this matrix.
