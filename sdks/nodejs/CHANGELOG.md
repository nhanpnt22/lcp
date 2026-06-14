# Changelog

## 1.1.0

- Added `FilePersistentStore` for JSON-file-based local cache persistence, keyed directly by the canonical H57 `cache_key`.
- Added `file` as a selectable `LCP_LOCAL_BACKEND` value, with `LCP_FILE_CACHE_ROOT` controlling the on-disk root.
- Added file store unit/contract tests and a File vs SQLite vs Cloud Storage benchmark suite.

## 1.0.0

- Initial standalone Node.js SDK release for Firebase App Hosting aligned to LCP v1.0.0.
