# REF-flutter-persistent-store-001

## Story

- Story ID: REF-flutter-persistent-store-001
- Title: Refactor Flutter persistent store path to comply with TEESI CODEX and production-grade release gates
- Type: ENABLER (Architecture / Refactor)
- Scope: Flutter persistent store parity boundary

## Invariant (Behavior-Preserving)

- Preserve persistent store contract behavior for valid flows.
- Preserve deterministic cache key and serializer behavior.
- Preserve parity with canonical cross-SDK contract cases.

## Boundary

- sdks/flutter/lib/lcp_flutter_sdk.dart
- sdks/flutter/lib/src/storage/memory_cache_store.dart
- sdks/flutter/lib/src/storage/sqlite_persistent_cache_store.dart
- sdks/flutter/lib/src/validation/cache_validation.dart
- sdks/flutter/test/persistent_store_contract_test.dart

## Story Registration (Lifecycle Event)

- Event: STORY_REGISTRATION
- Story Key: story/ref-flutter-persistent-store-001
- Status Source: execution_history only

## Stage Tasks (17)

| Order | Stage | Task ID | task_key | Dependencies |
|---|---|---|---|---|
| 1 | 0.0 TEST DESIGN | T0 | task/ref-flutter-persistent-store-001/test-design | - |
| 2 | 1.0 PLANNING | T1 | task/ref-flutter-persistent-store-001/planning | T0 |
| 3 | 1.2 TASK REGISTRATION | T2 | task/ref-flutter-persistent-store-001/task-registration | T1 |
| 4 | 1.3 GRAPH BUILD | T3 | task/ref-flutter-persistent-store-001/graph-build | T2 |
| 5 | 1.5 KNOWLEDGE RESOLUTION | T4 | task/ref-flutter-persistent-store-001/knowledge-resolution | T3 |
| 6 | 1.6 KNOWLEDGE UPDATE | T5 | task/ref-flutter-persistent-store-001/knowledge-update | T4 |
| 7 | 1.7 CONTEXT INDEX UPDATE | T6 | task/ref-flutter-persistent-store-001/context-index-update | T5 |
| 8 | 1.8 CI VALIDATION | T7 | task/ref-flutter-persistent-store-001/ci-validation | T6 |
| 9 | 2.0 BUILD | T8 | task/ref-flutter-persistent-store-001/build | T7 |
| 10 | 3.0 QC | T9 | task/ref-flutter-persistent-store-001/qc | T8 |
| 11 | 4.0 QA | T10 | task/ref-flutter-persistent-store-001/qa | T9 |
| 12 | 5.0 EXECUTION | T11 | task/ref-flutter-persistent-store-001/execution | T10 |
| 13 | 5.5 DRIFT DETECTION | T12 | task/ref-flutter-persistent-store-001/drift-detection | T11 |
| 14 | 6.0 UAT | T13 | task/ref-flutter-persistent-store-001/uat | T12 |
| 15 | 7.0 VALIDATION | T14 | task/ref-flutter-persistent-store-001/corex-validation | T13 |
| 16 | 7.5 CACHE VALIDATION | T15 | task/ref-flutter-persistent-store-001/cache-validation | T14 |
| 17 | 8.0 RELEASE | T16 | task/ref-flutter-persistent-store-001/release | T15 |

## DAG Edges

- T0 -> T1 -> T2 -> T3 -> T4 -> T5 -> T6 -> T7 -> T8 -> T9 -> T10 -> T11 -> T12 -> T13 -> T14 -> T15 -> T16

## Hard-Stop Rules

- No CI pass -> no build/release claim.
- No drift detection -> execution invalid.
- No cache validation -> release invalid.

## Acceptance Criteria

### Functional
- Behavior unchanged for valid inputs.
- Deterministic outcomes for equivalent requests.

### Structural
- No hidden state or implicit dependency in touched slice.
- Contract parity case coverage retained.

### Validation
- Flutter contract tests pass.
- No unresolved critical drift.

## Completion Evidence (Session)

- Flutter persistent store contract suite passed (7/7).
- Contract parity evidence case retained.

## Stage Execution Status (2026-05-29)

| Task ID | Stage | Status | Evidence |
|---|---|---|---|
| T0 | 0.0 TEST DESIGN | SUCCESS | persistent-store and read-through gate scope defined |
| T1 | 1.0 PLANNING | SUCCESS | deterministic hardening slice limited to Flutter store path |
| T2 | 1.2 TASK REGISTRATION | SUCCESS | task contracts registered in this story |
| T3 | 1.3 GRAPH BUILD | SUCCESS | DAG edges persisted and acyclic |
| T4 | 1.5 KNOWLEDGE RESOLUTION | SUCCESS | strict H57 impact on engine tests identified |
| T5 | 1.6 KNOWLEDGE UPDATE | SUCCESS | remediation facts captured in session evidence |
| T6 | 1.7 CONTEXT INDEX UPDATE | SUCCESS | execution outcomes indexed in TEESI docs set |
| T7 | 1.8 CI VALIDATION | SUCCESS | dart test passed after remediation |
| T8 | 2.0 BUILD | SUCCESS | deterministic test harness adjustments completed |
| T9 | 3.0 QC | SUCCESS | quality checks pass under full test suite |
| T10 | 4.0 QA | SUCCESS | read-through behavior validated with canonical keys |
| T11 | 5.0 EXECUTION | SUCCESS | full test execution completed |
| T12 | 5.5 DRIFT DETECTION | SUCCESS | drift found and remediated (base64/literal key -> h57HashFn/computeCacheKey) |
| T13 | 6.0 UAT | SUCCESS | production-grade acceptance criteria met |
| T14 | 7.0 VALIDATION | SUCCESS | replay-safe validation evidence captured |
| T15 | 7.5 CACHE VALIDATION | SUCCESS | canonical H57 constraints validated |
| T16 | 8.0 RELEASE | SUCCESS | release test gate complete for Flutter scope |

## Failure Modes (error_code examples)

- VALIDATION.CI_FAILED
- VALIDATION.REPLAY_MISMATCH
- VALIDATION.CACHE_INVALID
- EXECUTION.NON_DETERMINISTIC
- RELEASE.GATE_BLOCKED

## Definition Of Done

- Exactly one SUCCESS execution path per stage task.
- Behavior-preserving boundary maintained.
- Structural and validation gates passed with evidence.
- No unresolved critical drift.
