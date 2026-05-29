---
name: refactor
description: 'Run a deterministic TEESI refactor workflow that preserves behavior while reducing complexity, splitting oversized units, enforcing explicit dependencies, and closing with CI/replay/release evidence. Use when requests mention refactor, structural cleanup, maintainability hardening, CODEX compliance, drift remediation, or production-grade refactor.'
argument-hint: 'Target component/module and invariant behavior to preserve'
user-invocable: true
disable-model-invocation: false
---

# Refactor (Deterministic, Behavior-Preserving)

Use this skill for structure-first refactors where behavior must stay stable and completion requires objective execution evidence.

Default mode:

- Work on the current local refactor slice first.
- Preserve behavior strictly unless functional change is explicitly approved.
- Use focused gates by default; run full release gates when user asks for release readiness/production-grade closure.

Companion skills:

- `codex`: broader deterministic analysis and hardening plan.
- `split-task`: full 17-stage TEESI story DAG decomposition.
- `code`: execute one READY task sequentially under TEESI constraints.

## When To Use

- User asks to refactor for maintainability, complexity, determinism, or production hardening.
- You need to split oversized files/functions/modules without changing intended outputs.
- You need TEESI/CODEX-style controls: explicit dependencies, sequential execution, hard-stop gates, and drift closure.

## Inputs

- Target surface: file/module/component/workflow.
- Behavior invariant: what must remain unchanged.
- Current violations: size, complexity, duplication, hidden state, non-determinism, implicit dependency.
- Gate requirements: typecheck/tests/CI/replay/cache/release checks.
- Scope boundary: local slice only vs story-wide multi-stage refactor.

## Mode Selection

1. Local Refactor Mode (default)
- Use for direct code cleanup or maintainability hardening in current slice.
- Keep steps minimal and reversible.

2. Story DAG Mode (when requested)
- Use when user asks for full TEESI lifecycle or stage-complete planning.
- Materialize mandatory stage coverage with story registration lifecycle event plus deterministic stage tasks.

## Deterministic Workflow

1. Lock invariant behavior.
- State exactly what cannot change.
- If invariant is ambiguous, stop and define it first.

2. Baseline current state.
- Read the controlling implementation path first.
- Run existing checks before editing to establish evidence.

3. Classify violations by severity.
- High: non-determinism, hidden dependency, identity drift, data integrity risk.
- Medium: complexity/size excess, repeated logic, mixed abstraction.
- Low: ergonomics/docs/cleanup.

4. Split before grow.
- One unit, one responsibility.
- If limits are exceeded, split immediately.
- Prefer pure-vs-side-effect and dependency-seam splits.

5. Refactor one slice at a time.
- Make the smallest reversible change.
- Do not combine unrelated fixes in one step.
- Keep defaults safe; use explicit opt-in for risky behavior.

6. Validate immediately.
- Run the narrowest discriminating check after each substantive edit.
- Add/adjust regression tests for new constraints or failure modes.

7. Enforce stage gates for closure.
- Require CI pass before build/release claims.
- Require drift detection after execution.
- Require cache/replay validation when identity-sensitive behavior is touched.

8. Re-run release-grade gates.
- Typecheck
- Focused suites for touched behavior
- Full suite when release readiness is requested
- Packaging/release artifact dry-run when applicable

9. Report evidence and residual risk.
- Findings first, severity ordered.
- Include exact gate outcomes.
- If unresolved drift/blockers exist, do not mark complete.

## Full TEESI Stage Workflow (Story DAG Mode)

When Story DAG Mode is requested, enforce stage order and coverage:

1. TEST DESIGN
2. STORY REGISTRATION (lifecycle event)
3. PLANNING
4. TASK REGISTRATION
5. GRAPH BUILD
6. KNOWLEDGE RESOLUTION
7. KNOWLEDGE UPDATE
8. CONTEXT INDEX UPDATE
9. CI VALIDATION
10. BUILD
11. QC
12. QA
13. EXECUTION
14. DRIFT DETECTION
15. UAT
16. VALIDATION (COREX-equivalent)
17. CACHE VALIDATION
18. RELEASE

## Decision Points

- If a change alters observable behavior without explicit approval: rollback/fix before continuing.
- If a dependency is implied but not modeled: add explicit edge/dependency.
- If gate failures are unrelated to touched scope: document as external blocker unless release scope requires full green.
- If artifact output includes unintended files: tighten build/package boundaries before closing.

## Structural Limits

- File hard limit: <= 300 lines
- Module/class hard limit: <= 200 lines
- Function hard limit: <= 40 lines
- Cyclomatic complexity: <= 10
- Nesting depth: <= 3
- Parameters: <= 5

## Completion Checks

- Behavior invariant preserved.
- Refactored units satisfy structural limits.
- New/changed constraints have regression coverage.
- Deterministic gates pass for requested scope.
- Drift is resolved or captured as follow-up work.
- Release readiness claim is backed by command evidence.
- If unrelated failures remain outside scope, mark as external blockers unless full-green closure was explicitly requested.

## Output Shape

1. Invariant and target boundary
2. Violations and severity
3. Refactor slices (ordered)
4. Validation gates and outcomes
5. Residual risks/blockers
6. Next deterministic slice (if any)

## Avoid

- Opportunistic broad rewrites.
- Mixing behavior changes with structural refactor.
- Skipping gates after “looks good” edits.
- Declaring complete with unresolved critical drift.
