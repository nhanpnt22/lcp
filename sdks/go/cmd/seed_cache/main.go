package main

import (
	"fmt"
	"os"
	"strconv"

	lcp "github.com/nhanpnt22/lcp/sdks/go"
)

func envOr(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func envInt64Or(key string, fallback int64) int64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func main() {
	store, cfg, err := lcp.NewPersistentStoreFromEnv[map[string]any]()
	if err != nil {
		panic(err)
	}
	if store == nil {
		panic("persistent store is nil")
	}

	seedNamespace := envOr("LCP_SEED_NAMESPACE", "lcp")
	seedOperationID := envOr("LCP_SEED_OPERATION_ID", "seed-cache")
	seedSchemaVersion := envOr("LCP_SEED_SCHEMA_VERSION", "v1")
	seedSpecChecksum := envOr("LCP_SEED_SPEC_CHECKSUM", "spec")
	seedUserScope := envOr("LCP_SEED_USER_SCOPE", "testing")
	cacheValue := envOr("LCP_SEED_CACHE_VALUE", "seeded-via-sdk")
	createdAt := envInt64Or("LCP_SEED_CREATED_AT", 1700000000000)
	ttlMs := envInt64Or("LCP_SEED_TTL_MS", 86400000)

	payload := map[string]any{"value": cacheValue}
	cacheKey, err := lcp.ComputeCacheKey(lcp.CacheKeyInput{
		Namespace:     seedNamespace,
		OperationID:   seedOperationID,
		Payload:       payload,
		SchemaVersion: seedSchemaVersion,
		SpecChecksum:  seedSpecChecksum,
		UserScope:     seedUserScope,
	}, lcp.H57HashFn)
	if err != nil {
		panic(err)
	}

	entry := lcp.CacheEntry[map[string]any]{
		CacheKey: cacheKey,
		Data:     payload,
		Metadata: lcp.CreateCacheMetadata(
			lcp.CacheSourceAPI,
			createdAt,
			ttlMs,
			seedSchemaVersion,
			"v1",
			seedSpecChecksum,
			seedNamespace,
			false,
		),
	}

	if err := store.Set(entry); err != nil {
		panic(err)
	}

	loaded, err := store.Get(cacheKey)
	if err != nil {
		panic(err)
	}
	if loaded == nil {
		panic("seeded entry not found")
	}

	fmt.Printf("backend=%s cache_key=%s value=%v\n", cfg.Backend, loaded.CacheKey, loaded.Data["value"])
}
