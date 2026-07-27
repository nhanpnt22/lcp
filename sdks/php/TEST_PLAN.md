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
- Shared persistent-store contract, run against **every** backend
  (`tests/Storage/PersistentStoreContractTestCase.php`, mirroring
  `runStoreContractSuite` in the NodeJS SDK):
  - set/get round-trip
  - get on missing key returns null
  - overwrite existing key
  - delete removes entry; delete of a missing key is a no-op
  - clear removes all entries
  - pruneExpired removes expired entries only
  - hydrateAllValid excludes expired entries and respects limit
  - hydrateAllValid on an empty store returns an empty array
  - lazy expiry on `get` (expired entry deleted on read)
  - invalid H57 cache key rejected on get/set/delete
  - round-trip preserves all metadata fields
- SQLite backend specifics:
  - hydrateAllValid orders by most-recently-updated first
  - db directory created when missing
  - blank path rejected
  - entries persist across store instances
- File backend specifics:
  - hydrateAllValid orders by cache key ascending
  - entry stored as `<rootDir>/<cache_key>.json` with the expected payload
  - root directory created when missing
  - atomic write leaves no `.tmp` file behind
  - blank rootDir rejected
  - operations on a missing root directory are safe (no fatal)
  - corrupt JSON and non-`.json` files are skipped rather than fatal
  - entries persist across store instances

## Release Criteria

- all mandatory gates pass
- no wire-format drift from the Go/NodeJS/Flutter `CacheEntry`/`CacheMetadata`
  JSON shape (see `sdks/PARITY_MATRIX.md`)
