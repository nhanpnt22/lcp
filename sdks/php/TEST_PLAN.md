# LCP PHP SDK Release Test Plan

## Mandatory Gates

1. `composer install`
2. `composer test` (`vendor/bin/phpunit`)

## Coverage Areas

- B57 codec:
  - round-trip encode/decode over random byte strings
  - leading-zero-byte preservation
  - invalid-character rejection
  - canonical-form checks
- H57 cache-key validation:
  - canonical key acceptance
  - whitespace trimming
  - empty/invalid key rejection with operation-scoped error message
- SQLite persistent store:
  - set/get round-trip
  - overwrite existing key
  - delete removes entry
  - clear removes all entries
  - pruneExpired removes expired entries only
  - hydrateAllValid excludes expired entries and respects limit
  - hydrateAllValid orders by most-recently-updated first
  - lazy expiry on `get` (expired row deleted on read)
  - invalid H57 cache key rejected on get/set
  - sqlite db directory created when missing

## Release Criteria

- all mandatory gates pass
- no wire-format drift from the Go/NodeJS/Flutter `CacheEntry`/`CacheMetadata`
  JSON shape (see `sdks/PARITY_MATRIX.md`)
