# LCP Go SDK Release Test Plan

## Mandatory Gates

1. `go test ./...`
2. `go test -race ./...`

## Coverage Areas

- deterministic key material and trace-field stripping
- memory store hit/miss/expiry behavior
- sqlite persistent store behavior:
  - set/get round-trip
  - prune expired entries
  - hydrate valid entries with deterministic limit handling
- cloud-storage persistent store behavior:
  - set/get round-trip through object storage APIs
  - prune/hydrate semantics and metadata consistency
  - optional requester-pays/user-project integration profile via env-gated test
- cloud run store mode selection:
  - in-memory mode factory path
  - sqlite mode factory path and required path validation
  - cloud-storage mode factory path and required URI validation
- read-through execution path:
  - API then cache
  - missing TTL bypass behavior
  - stale-state bypass to API
  - write-failure safe degradation
- resume helpers determinism
- serializer determinism baseline

## Release Criteria

- all mandatory gates pass
- no protocol invariant regressions in key/cache/validation/engine paths
