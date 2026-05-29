# AI Onboarding

This guide is for coding agents working in the LCP repository.

## Objective

Deliver safe, minimal, test-backed changes while preserving cross-SDK parity and CI/UAT stability.

## Ground Truth Files

Read these first:

- README.md
- docs/LCP — Local Cache Protocol.txt
- sdks/PARITY_MATRIX.md
- docs/cross-parity-summary.md

Then inspect workflow files:

- .github/workflows/go-sdk-ci.yml
- .github/workflows/nodejs-sdk-ci.yml
- .github/workflows/flutter-sdk-ci.yml
- .github/workflows/javascript-sdk-ci.yml

## Behavioral Priorities

1. Preserve protocol behavior and deterministic cache semantics.
2. Preserve H57 key expectations across SDKs.
3. Keep CI UAT gates green.
4. Prefer minimal, targeted edits.

## Repository Expectations

- JavaScript CI should test JS browser/IndexedDB behavior without requiring Flutter runtime.
- NodeJS CI depends on JavaScript SDK artifacts being built first.
- Flutter CI depends on resolvable dependencies in hosted runners.
- Go and NodeJS Cloud Storage UAT require credentials and cloud URI env vars.

## Safe Edit Workflow

1. Read files before editing.
2. Modify the smallest relevant set of files.
3. Run focused tests first.
4. Run broader gates if behavior changed.
5. Confirm no accidental artifact churn is committed.

## Validation Commands

Go Cloud UAT:

```bash
cd sdks/go
go test -count=1 -v -run 'TestPersistentStoreCloudContract(SetGetValue|Overwrite|Delete|Clear|PruneExpired|HydrateAllValidAndLimit|SetVisibleValueEvidence|RejectsNonH57ObjectFilename|RejectsCorruptObjectPayload)$' ./
```

NodeJS Cloud UAT:

```bash
npm --prefix sdks/nodejs exec vitest run tests/persistent.store.cloud.contract.test.ts tests/cloud.storage.persistent.store.test.ts --reporter=verbose
```

Flutter SQLite UAT:

```bash
cd sdks/flutter
dart test test/sqlite_persistent_cache_store_test.dart -r expanded
```

JavaScript IndexedDB UAT:

```bash
cd sdks/javascript
npm ci
npm run build
npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts tests/browser/sdk.idb.operations.spec.ts --project=chromium
```

## CI Failure Triage Heuristics

- TS2307 module errors in NodeJS CI: verify JavaScript SDK build/install ordering.
- Flutter dependency resolution errors: avoid local-only path dependencies in CI runners.
- Playwright ENOENT for flutter in JS CI: browser gate is running cross-SDK parity tests in the wrong workflow.
- GCP credential parse errors: pass secrets through env variables, not direct shell interpolation.

## Commit Hygiene

- Do not commit generated artifacts unless intentionally required.
- Do not commit local credentials or secrets.
- Keep commit messages specific to root cause and scope.

## Done Criteria

- Requested changes implemented.
- Relevant local validations pass.
- CI workflow intent remains consistent.
- Documentation updated when process changes.
