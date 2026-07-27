# LCP PHP SDK (SQLite persistent store)

PHP persistence layer for LCP v1.0.0, scoped to the SQLite backend and the
supporting cache-entry/cache-key primitives it depends on. This package does
**not** implement the full LCP SDK surface (no compression, execution engine,
SWR, trace, etc. — see [Scope](#scope)); it mirrors the persistent-store
contract shared by the Go, NodeJS, and Flutter SDKs so a PHP backend can read
and write the same on-disk cache format.

## Scope

Implemented, matching the equivalent modules in `sdks/go`, `sdks/nodejs`, and
`sdks/flutter`:

- `Lcp\Php\Entry\CacheEntry` / `CacheMetadata` / `CacheSource` — the same
  wire shape (snake_case JSON keys: `cache_key`, `data`, `metadata.source`,
  `metadata.created_at`, `metadata.expires_at`, `metadata.ttl_ms`, etc.).
- `Lcp\Php\Key\B57` — the B57 binary-to-text codec (alphabet
  `ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789`), ported from
  the reference implementation at
  [nhanpnt22/f57](https://github.com/nhanpnt22/f57) so this package has no
  `ext-gmp`/`ext-bcmath` dependency. No PHP branch exists upstream in `f57`
  yet, so this is a from-spec/from-source port, not a Composer dependency on
  that project.
- `Lcp\Php\Key\H57` — canonical H57 cache-key validation
  (`isH57CacheKey` / `assertH57CacheKey`), matching `validateH57CacheKey`
  (Go), `assertH57CacheKey` (NodeJS/Flutter). This validates the *format* of
  an existing cache key (charset + canonical round-trip); it does not
  generate H57 hashes (that requires BLAKE3, which the other SDKs pull in via
  `f57`'s hashing module — out of scope here since the SQLite store only
  needs to validate keys it's given).
- `Lcp\Php\Storage\SQLitePersistentStore` — `get`/`set`/`delete`/`clear`/
  `pruneExpired`/`hydrateAllValid`, backed by PDO SQLite. Schema and
  semantics mirror the NodeJS/Flutter SQLite stores (`cache_entries` table
  with `cache_key`, `entry_json`, `expires_at`, `updated_at`, indexed on
  `expires_at`; `hydrateAllValid` orders by `updated_at DESC`; expired rows
  are lazily deleted on `get`). See `sdks/PARITY_MATRIX.md` for the
  cross-SDK schema comparison (Go's SQLite store uses a simpler
  key→blob-only schema with app-side TTL filtering).

Not implemented (out of scope for this package): compression, consistency
serializer, read-through execution engine, failure classification, namespace
isolation, resume helpers, single-flight, SWR, trace, TTL evaluation as a
standalone module, validation invariants beyond cache-key format, in-memory/
file/cloud-storage persistent stores, and H57 hash *generation*.

## Install

```bash
composer require lcp/php-sdk
```

## Usage

```php
use Lcp\Php\Entry\CacheEntry;
use Lcp\Php\Entry\CacheMetadata;
use Lcp\Php\Entry\CacheSource;
use Lcp\Php\Key\B57;
use Lcp\Php\Storage\SQLitePersistentStore;

$store = new SQLitePersistentStore('/var/lib/lcp/lcp-cache.db');

// Cache keys must be canonical H57 (a B57-encoded hash string) — see
// Lcp\Php\Key\H57::assertH57CacheKey / isH57CacheKey.
$cacheKey = B57::encode(hash('sha256', 'example', true));

$entry = new CacheEntry(
    $cacheKey,
    ['value' => 'alpha'],
    CacheMetadata::create(
        source: CacheSource::Api,
        createdAt: (int) (microtime(true) * 1000),
        ttlMs: 60_000,
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec-v1',
        cacheNamespace: 'ns',
        compressed: false,
    ),
);

$store->set($entry);
$got = $store->get($cacheKey);          // CacheEntry|null
$store->pruneExpired();                  // int removed
$valid = $store->hydrateAllValid(100);   // CacheEntry[]
```

## Verification

```bash
composer install
composer test
```
