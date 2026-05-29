# REF-nodejs-cloud-storage-001

## Story

- Story ID: REF-nodejs-cloud-storage-001
- Title: Refactor NodeJS Cloud Storage to comply with TEESI CODEX and production-grade release gates
- Type: ENABLER (Architecture / Refactor)
- Scope: NodeJS Cloud Storage path only

## Invariant (Behavior-Preserving)

The following behavior must remain unchanged for valid inputs:

- deterministic cache key handling
- successful set/get/delete/clear/prune/hydrate semantics
- no functional expansion outside Cloud Storage hardening boundary

The following strictness must be enforced:

- canonical H57 object filename handling
- fail-fast on payload integrity mismatches
- explicit opt-in behavior for UserProject requester-pays path

## Boundary

- sdks/nodejs/src/stores/cloud.storage.persistent.store.ts
- sdks/nodejs/src/env.ts
- sdks/nodejs/src/types.ts
- sdks/nodejs/src/engine.ts
- sdks/nodejs/tests/persistent.store.cloud.contract.test.ts
- sdks/nodejs/tests/cloud.storage.persistent.store.test.ts
- sdks/nodejs/tests/env.test.ts
- sdks/nodejs/package.json
- sdks/nodejs/tsconfig.build.json
- sdks/nodejs/README.md

## Story Registration (Lifecycle Event)

- Event: STORY_REGISTRATION
- Story Key: story/ref-nodejs-cloud-storage-001
- Status Source: execution_history only

## Stage Tasks (17 Deterministic Tasks)

| Order | Stage | Task ID | task_key | Input | Expected Output | Dependencies |
|---|---|---|---|---|---|---|
| 1 | 0.0 TEST DESIGN | T0 | task/ref-nodejs-cloud-storage-001/test-design | existing tests + invariants | focused test design for cloud strictness + release gates | - |
| 2 | 1.0 PLANNING | T1 | task/ref-nodejs-cloud-storage-001/planning | baseline behavior + constraints | local-slice deterministic refactor plan | T0 |
| 3 | 1.2 TASK REGISTRATION | T2 | task/ref-nodejs-cloud-storage-001/task-registration | stage tasks + contracts | all tasks persisted with explicit contracts | T1 |
| 4 | 1.3 GRAPH BUILD | T3 | task/ref-nodejs-cloud-storage-001/graph-build | task list | acyclic DAG edges persisted | T2 |
| 5 | 1.5 KNOWLEDGE RESOLUTION | T4 | task/ref-nodejs-cloud-storage-001/knowledge-resolution | deps + platform constraints | dependency/security compatibility facts | T3 |
| 6 | 1.6 KNOWLEDGE UPDATE | T5 | task/ref-nodejs-cloud-storage-001/knowledge-update | resolved knowledge | knowledge snapshot persisted | T4 |
| 7 | 1.7 CONTEXT INDEX UPDATE | T6 | task/ref-nodejs-cloud-storage-001/context-index-update | updated knowledge | searchable context index refreshed | T5 |
| 8 | 1.8 CI VALIDATION | T7 | task/ref-nodejs-cloud-storage-001/ci-validation | code + tests | structural/quality gate pass before build claim | T6 |
| 9 | 2.0 BUILD | T8 | task/ref-nodejs-cloud-storage-001/build | approved plan | deterministic code changes applied | T7 |
| 10 | 3.0 QC | T9 | task/ref-nodejs-cloud-storage-001/qc | changed files | static quality checks pass | T8 |
| 11 | 4.0 QA | T10 | task/ref-nodejs-cloud-storage-001/qa | runtime behavior checks | behavior-preserving validation pass | T9 |
| 12 | 5.0 EXECUTION | T11 | task/ref-nodejs-cloud-storage-001/execution | test commands + scripts | deterministic execution evidence captured | T10 |
| 13 | 5.5 DRIFT DETECTION | T12 | task/ref-nodejs-cloud-storage-001/drift-detection | expected vs actual | no unresolved critical drift or remediation task created | T11 |
| 14 | 6.0 UAT | T13 | task/ref-nodejs-cloud-storage-001/uat | production-grade criteria | user-facing acceptance validated | T12 |
| 15 | 7.0 VALIDATION | T14 | task/ref-nodejs-cloud-storage-001/corex-validation | execution evidence | replay-safe validation checksum pass | T13 |
| 16 | 7.5 CACHE VALIDATION | T15 | task/ref-nodejs-cloud-storage-001/cache-validation | cache identity rules | cache consistency validated pre-release | T14 |
| 17 | 8.0 RELEASE | T16 | task/ref-nodejs-cloud-storage-001/release | all prior stage outputs | release-ready status with audit evidence | T15 |

## DAG Edges

- T0 -> T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16

## Hard-Stop Rules

- No CI pass -> no build/release claim
- No drift detection -> execution invalid
- No cache validation -> release invalid
- Any failed dependency -> downstream task BLOCKED

## Acceptance Criteria

### Functional

- behavior remains unchanged for valid paths
- deterministic outputs for identical inputs

### Structural

- no hidden dependency introduced
- no non-deterministic branch introduced
- boundary remains local to Cloud Storage path

### Validation

- typecheck passes
- focused cloud/env tests pass
- full NodeJS suite passes
- packaging dry-run passes with runtime-focused artifact

## Completion Evidence (Current)

- release gate command passed for NodeJS scope
- cloud strictness tests passed (non-H57 + payload mismatch)
- artifact dry-run shows lean runtime package contents

## Stage Execution Status (2026-05-29)

| Task ID | Stage | Status | Evidence |
|---|---|---|---|
| T0 | 0.0 TEST DESIGN | SUCCESS | strictness and release-gate test scope defined in story and validated in session |
| T1 | 1.0 PLANNING | SUCCESS | deterministic local-slice refactor plan executed |
| T2 | 1.2 TASK REGISTRATION | SUCCESS | task contracts registered in this story |
| T3 | 1.3 GRAPH BUILD | SUCCESS | linear acyclic DAG edges persisted |
| T4 | 1.5 KNOWLEDGE RESOLUTION | SUCCESS | environment and strictness constraints resolved |
| T5 | 1.6 KNOWLEDGE UPDATE | SUCCESS | completion evidence updated after gates |
| T6 | 1.7 CONTEXT INDEX UPDATE | SUCCESS | execution status consolidated in docs index set |
| T7 | 1.8 CI VALIDATION | SUCCESS | typecheck and tests passed |
| T8 | 2.0 BUILD | SUCCESS | deterministic build completed via prepack |
| T9 | 3.0 QC | SUCCESS | quality checks passed in release:check path |
| T10 | 4.0 QA | SUCCESS | cloud contract validations passed |
| T11 | 5.0 EXECUTION | SUCCESS | release gate executed end-to-end |
| T12 | 5.5 DRIFT DETECTION | SUCCESS | no unresolved critical drift |
| T13 | 6.0 UAT | SUCCESS | production-grade acceptance criteria satisfied |
| T14 | 7.0 VALIDATION | SUCCESS | replay-safe release evidence captured |
| T15 | 7.5 CACHE VALIDATION | SUCCESS | H57 and payload integrity constraints validated |
| T16 | 8.0 RELEASE | SUCCESS | npm pack --dry-run passed with expected artifact scope |

## Failure Modes (error_code examples)

- VALIDATION.CI_FAILED
- VALIDATION.DRIFT_DETECTED
- VALIDATION.CACHE_INVALID
- EXECUTION.NON_DETERMINISTIC
- RELEASE.GATE_BLOCKED

## Definition Of Done

- exactly one SUCCESS execution path for each stage task
- no unresolved critical drift
- release status backed by command evidence
- story remains behavior-preserving within declared boundary
