# Changelog

## 1.2.0

- Upgraded the F57 dependency to `f57-js@v0.3.1-javascript` (from the deleted `v0.1.4-javascript` tag), which fixes a broken install: upstream removed the `v0.1.4-*` tags and, as of v0.3.0, moved the JavaScript package to `implementations/javascript/` with no manifest at the git root, so `npm install` could not resolve it. F57 v0.3.1 adds a root manifest with an `exports` map; see https://github.com/nhanpnt22/f57/releases/tag/v0.3.1.
- No cache-key or wire-format change: F57's B57/H57 sources are byte-identical across `v0.1.4`/`v0.3.0`/`v0.3.1`, verified by comparing `h57Hash` output on shared inputs.

## 1.0.0

- Initial public release of LCP JavaScript SDK.
- Added deterministic read-through cache engine with memory and IndexedDB support.
- Added canonical browser global artifacts and compatibility alias.
- Added protocol validation, resume helpers, and release test portfolio.
