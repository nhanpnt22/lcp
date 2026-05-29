# Developer Onboarding

This guide helps engineers become productive in the LCP workspace quickly.

## Purpose

LCP (Local Cache Protocol) provides cross-SDK cache behavior parity across:

- JavaScript (IndexedDB)
- Flutter (SQLite)
- Go (memory, SQLite, Cloud Storage)
- NodeJS (memory, SQLite, Cloud Storage)

Primary protocol reference:

- docs/LCP — Local Cache Protocol.txt

## Repository Map

- sdks/javascript: Web/browser SDK and Playwright browser tests
- sdks/flutter: Flutter SDK and SQLite tests
- sdks/go: Go SDK, Cloud Storage integration, parity evidence tests
- sdks/nodejs: NodeJS SDK, Cloud Storage integration, parity evidence tests
- docs/cross-parity-summary.md: parity findings and evidence summary
- sdks/PARITY_MATRIX.md: feature/status matrix across SDKs

## Prerequisites

Install the toolchains used by this monorepo:

- Node.js 20+
- npm 10+
- Go (see version in sdks/go/go.mod)
- Dart/Flutter (for Flutter SDK and parity tests that invoke Flutter)

Optional for Cloud Storage tests:

- GCP service account key (JSON)
- Access to test bucket/prefix

## Environment Variables

For Cloud Storage UAT and integration tests:

- GOOGLE_CLOUD_PROJECT
- LCP_STORAGE_GCS_URI
- GCP_SA_KEY or GOOGLE_APPLICATION_CREDENTIALS

## Quick Start

1. Read protocol and profile docs.
2. Pick one SDK and run its release gate locally.
3. Run cross-SDK parity workflows.
4. Make changes with parity and CI impact in mind.

## Local Commands

JavaScript:

```bash
npm --prefix sdks/javascript ci
npm --prefix sdks/javascript run test:release
npm --prefix sdks/javascript run test:browser
```

NodeJS:

```bash
npm --prefix sdks/javascript ci
npm --prefix sdks/javascript run build
npm --prefix sdks/nodejs ci
npm --prefix sdks/nodejs run release:check
```

Go:

```bash
cd sdks/go
go test ./...
go test -race ./...
```

Flutter:

```bash
cd sdks/flutter
dart pub get
dart analyze
dart test
```

Cross-SDK evidence scripts:

```bash
./scripts/run_cross_go_nodejs_sqlite_evidence.sh
./scripts/run_cross_go_javascript_onebyone.sh
./scripts/run_cross_go_javascript_cloud_onebyone.sh
```

## CI UAT Gates (What Must Stay Green)

- Go SDK CI: Cloud Storage cache UAT (all cache functions)
- NodeJS SDK CI: Cloud Storage cache UAT (all cache functions)
- Flutter SDK CI: SQLite cache UAT (all cache functions)
- JavaScript SDK CI: IndexedDB Playwright UAT (all cache functions)

## Contribution Rules

- Preserve protocol semantics and deterministic behavior.
- Keep cache key behavior H57-compatible across SDKs.
- Add or update tests with any behavior change.
- Avoid introducing SDK-specific divergence without parity notes.
- Update docs when CI gates, test paths, or evidence flows change.

## Pull Request Checklist

- Relevant local tests pass for touched SDKs.
- Cross-SDK parity remains green.
- CI UAT gates are green.
- README/docs updated when workflow behavior changes.
- No secrets committed.
