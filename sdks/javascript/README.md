# LCP JavaScript SDK

JavaScript SDK workspace for Local Cache Protocol (LCP) v1.0.0.

This package is standalone and consumable as a module package.

## Protocol Alignment

- Parent protocol: https://github.com/nhanpnt22/lcp/blob/main/docs/LCP%20%E2%80%94%20Local%20Cache%20Protocol.txt
- Language profile: https://github.com/nhanpnt22/lcp/blob/main/profiles/javascript/LCP%20%E2%80%94%20JavaScript%20SDK%20Profile(Web).txt

This SDK must preserve protocol invariants: deterministic keying, non-authoritative read-through behavior, no-backflow, and parity-safe metadata handling.

Parity tracking across JavaScript and Flutter SDKs is maintained in `../PARITY_MATRIX.md`.

## Package Purpose

This package produces:

- `dist/index.js` (ESM)
- `dist/index.cjs` (CommonJS)
- `dist/index.d.ts` (TypeScript declarations)
- `dist/lcp-javascript-sdk.min.js` (IIFE browser global, canonical)
- `dist/lcp-javascript-sdk-<package-version>.min.js` (IIFE browser global, version-pinned)
- `dist/browser.min.js` (IIFE browser global, compatibility alias)

The browser bundle exposes `window.LcpLocalCache` as the primary LCP browser global.
`window.SdalpLocalCache` remains available as a legacy-compatible alias.

Production browser bundles are emitted with ES2020 targets and source maps to improve runtime compatibility and debugging:

- `dist/lcp-javascript-sdk.min.js` + `dist/lcp-javascript-sdk.min.js.map`
- `dist/lcp-javascript-sdk-<package-version>.min.js` + `dist/lcp-javascript-sdk-<package-version>.min.js.map`
- `dist/browser.min.js` + `dist/browser.min.js.map`
- `min/lcp-local-cache.min.js` + `min/lcp-local-cache.min.js.map`

## Build

```bash
npm install
npm run build
```

## Consume

```ts
import { ReadThroughCacheEngine } from "@sdp/lcp-javascript-sdk";
```

Browser global build:

```html
<script src="dist/lcp-javascript-sdk.min.js"></script>
<script>
	const sdk = window.LcpLocalCache ?? window.SdalpLocalCache;
</script>
```

## Typecheck

```bash
npm run typecheck
```

## Test Suites

```bash
npm run test
npm run test:unit
npm run test:integration
npm run test:contract
npm run test:runtime
npm run test:browser
npm run test:coverage
```

## HTML Browser UAT

Run HTML-driven browser UAT checks in Chromium:

```bash
node scripts/browser-uat-check.mjs
```

Expected pass output:

- `[browser-uat] PASS lcp-uat: UAT PASSED (AC 15/15)`
- `[browser-uat] PASS lcp-simple-cache: SELF-TEST PASSED`
- `[browser-uat] PASS all browser UAT checks`

Pages covered by this check:

- `examples/lcp-uat.html`
- `examples/simple-cache.html`

## Smoke Test

```bash
npm run smoke
```

This validates standalone artifacts and basic ESM/CJS/browser bundle export presence.

## Public npm Release Checklist

```bash
npm run smoke
npm pack --dry-run
```

Detailed release gates and test portfolio are documented in `TEST_PLAN.md`.
Cross-SDK parity checks are documented in `../PARITY_MATRIX.md`.

## Production-Readiness Checklist

- [x] Core contract tests pass
- [x] H57 cache keys enforced in tested paths
- [x] Browser bundle builds cleanly with ES2020 target
- [x] Source maps generated for release artifacts
- [x] Cross-SDK parity passes for seven-case matrix
- [ ] Broad browser support matrix validated
- [ ] Production deployment/ops validation completed
- [ ] Load and performance validation completed
- [ ] Long-term backward-compatibility validation completed

Publish from this folder:

```bash
npm publish --access public
```

## Export Policy

- Stable module entrypoint is package root (`@sdp/lcp-javascript-sdk`).
- Stable browser entrypoint is `@sdp/lcp-javascript-sdk/browser`.
- Compatibility browser alias is `@sdp/lcp-javascript-sdk/browser-legacy`.
- Canonical browser artifact filename stays unversioned (`dist/lcp-javascript-sdk.min.js`); package version in `package.json` is the release version source of truth.
- Optional versioned artifacts may be added only for CDN cache pinning, while keeping the canonical unversioned filename unchanged.
- Internal source paths are implementation details and are not part of the public API contract.
- Behavior changes must remain compatible with LCP v1.0.0 invariants.
