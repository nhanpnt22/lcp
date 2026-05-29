---
name: codex
description: 'Run a deterministic CODEX workflow for production-grade SDK hardening: assess, patch, validate, and release-check with explicit gates. Use when requests mention codex, TEESI, production-grade, deterministic, replay-safe, cloud storage hardening, release readiness, or cross-SDK parity.'
argument-hint: 'Target SDK/module and production outcome (e.g., "NodeJS Cloud Storage fully production-grade")'
user-invocable: true
disable-model-invocation: false
---

# CODEX Production Hardening

Use this skill to convert a broad "make it production-grade" request into a deterministic, auditable workflow with explicit gates.

## When To Use

- User asks for "production-grade", "harden", "audit-ready", "deterministic", or "CODEx/TEESI".
- Work includes Cloud Storage, strict cache key validation, parity checks, or release packaging.
- You need a repeatable plan that ends with objective pass/fail evidence.

## Inputs

- Target surface: SDK/language/module.
- Runtime/storage context: memory/sqlite/cloud-storage.
- Non-negotiables: identity format, strictness level, fail-fast policy.
- Release gates: typecheck/tests/packaging/race checks.

## Workflow

1. Define atomic outcome.
- Example: "NodeJS Cloud Storage path is production-grade and release-packable."
- Reject mixed outcomes in one pass; split if needed.

2. Baseline current state.
- Read implementation, env/config wiring, tests, and release docs.
- Identify exact current behavior and missing guarantees.

3. Run authoritative gates first.
- Execute existing focused gates before editing.
- Record failures as concrete findings, not assumptions.

4. Classify findings by severity.
- High: data integrity, identity drift, unsafe defaults, hidden failure.
- Medium: weak validation, missing coverage, packaging/release risk.
- Low: doc gaps, ergonomics, non-blocking cleanup.

5. Patch in smallest deterministic increments.
- Prefer strict validation at boundaries.
- Prefer fail-fast on corruption or invariant mismatch.
- Keep behavior stable unless requested; use explicit opt-in for risky features.

6. Add regression tests for each new rule.
- Add at least one test per critical branch.
- Ensure tests prove failure mode and expected safe behavior.

7. Re-run full gates.
- Typecheck
- Focused suites for touched behavior
- Full suite when release readiness is requested
- Packaging dry-run for publishable artifacts

8. Verify release artifact quality.
- Ensure published files are intentional.
- Enforce prepack/build gate so tarball is never empty or stale.

9. Report with evidence and residual risk.
- Findings first, ordered by severity.
- Include exact gate results and remaining non-blocking risks.

## Decision Points

- If environment-dependent auth/billing behavior can break defaults:
  - keep default safe
  - add explicit opt-in flag and validation
- If strictness mismatch appears (filename vs payload key, schema drift, invalid IDs):
  - fail fast instead of silently skipping
- If release artifact includes unrelated output:
  - split build configs and narrow includes
- If a gate fails outside touched area:
  - fix only if it blocks release evidence for this scope; otherwise document as external risk

## Completion Checks

- Targeted invariants are explicit and enforced in code.
- Regression tests cover new rules and failure paths.
- Typecheck/test/pack gates pass for the target SDK.
- Release artifact contains intended runtime outputs only.
- Findings and residual risks are documented.

## Output Shape

1. Findings (severity ordered)
2. Fixes applied (minimal diff summary)
3. Gate results (commands + outcomes)
4. Residual risks
5. Optional next hardening actions
