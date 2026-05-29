package lcp

import (
	"fmt"
	"os"
	"testing"
	"time"
)

func TestCloudStorageIntegrationFromEnv(t *testing.T) {
	requireCloudStorageIntegrationEnv(t)

	store, cfg, err := NewPersistentStoreFromEnv[map[string]any]()
	if err != nil {
		t.Fatalf("load persistent store from env: %v", err)
	}
	assertCloudStorageBackendConfig(t, store, cfg)

	nowMs := time.Now().UnixMilli()
	payload := map[string]any{"value": fmt.Sprintf("itest-%d", nowMs)}

	cacheKey, err := ComputeCacheKey(CacheKeyInput{
		Namespace:     "lcp",
		OperationID:   fmt.Sprintf("cloud-storage-integration-%d", nowMs),
		Payload:       payload,
		SchemaVersion: "v1",
		SpecChecksum:  "spec",
		UserScope:     "testing",
	}, H57HashFn)
	if err != nil {
		t.Fatalf("compute cache key: %v", err)
	}

	entry := CacheEntry[map[string]any]{
		CacheKey: cacheKey,
		Data:     payload,
		Metadata: CreateCacheMetadata(CacheSourceAPI, nowMs, 86400000, "v1", "v1", "spec", "lcp", false),
	}

	if err := store.Set(entry); err != nil {
		t.Fatalf("set cache entry: %v", err)
	}

	assertLoadedValue(t, store, cacheKey, payload)
	t.Logf("cloud-storage integration write verified via Go SDK: key=%s uri=%s", cacheKey, cfg.CloudStorageURI)
}

func TestCloudStorageIntegrationFromEnvUserProject(t *testing.T) {
	requireCloudStorageIntegrationUserProjectEnv(t)

	store, cfg, err := NewPersistentStoreFromEnv[map[string]any]()
	if err != nil {
		t.Fatalf("load persistent store from env: %v", err)
	}
	assertCloudStorageBackendConfig(t, store, cfg)
	if !cfg.CloudStorageUseUserProject {
		t.Fatalf("expected CloudStorageUseUserProject=true")
	}

	nowMs := time.Now().UnixMilli()
	payload := map[string]any{"value": fmt.Sprintf("itest-user-project-%d", nowMs)}

	cacheKey, err := ComputeCacheKey(CacheKeyInput{
		Namespace:     "lcp",
		OperationID:   fmt.Sprintf("cloud-storage-integration-user-project-%d", nowMs),
		Payload:       payload,
		SchemaVersion: "v1",
		SpecChecksum:  "spec",
		UserScope:     "testing",
	}, H57HashFn)
	if err != nil {
		t.Fatalf("compute cache key: %v", err)
	}

	entry := CacheEntry[map[string]any]{
		CacheKey: cacheKey,
		Data:     payload,
		Metadata: CreateCacheMetadata(CacheSourceAPI, nowMs, 86400000, "v1", "v1", "spec", "lcp", false),
	}

	if err := store.Set(entry); err != nil {
		t.Fatalf("set cache entry: %v", err)
	}

	assertLoadedValue(t, store, cacheKey, payload)
	t.Logf("cloud-storage integration with user project verified via Go SDK: key=%s uri=%s project=%s", cacheKey, cfg.CloudStorageURI, cfg.GoogleCloudProject)
}

func requireCloudStorageIntegrationEnv(t *testing.T) {
	t.Helper()
	if os.Getenv("LCP_CLOUD_STORAGE_INTEGRATION") != "1" {
		t.Skip("set LCP_CLOUD_STORAGE_INTEGRATION=1 to run cloud-storage integration test")
	}
	if os.Getenv("LCP_STORAGE_GCS_URI") == "" {
		t.Skip("set LCP_STORAGE_GCS_URI to run cloud-storage integration test")
	}
	if os.Getenv("LCP_PERSISTENT_ENABLED") == "" {
		t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	}
	if os.Getenv("LCP_RUNTIME_MODE") == "" {
		t.Setenv("LCP_RUNTIME_MODE", string(LCPRuntimeModeLocal))
	}
	if os.Getenv("LCP_LOCAL_BACKEND") == "" {
		t.Setenv("LCP_LOCAL_BACKEND", string(LCPPersistentBackendCloudStorage))
	}
}

func requireCloudStorageIntegrationUserProjectEnv(t *testing.T) {
	t.Helper()
	if os.Getenv("LCP_CLOUD_STORAGE_INTEGRATION_USER_PROJECT") != "1" {
		t.Skip("set LCP_CLOUD_STORAGE_INTEGRATION_USER_PROJECT=1 to run cloud-storage user-project integration test")
	}
	if os.Getenv("LCP_STORAGE_GCS_URI") == "" {
		t.Skip("set LCP_STORAGE_GCS_URI to run cloud-storage user-project integration test")
	}
	if os.Getenv("GOOGLE_CLOUD_PROJECT") == "" {
		t.Skip("set GOOGLE_CLOUD_PROJECT to run cloud-storage user-project integration test")
	}
	if os.Getenv("LCP_PERSISTENT_ENABLED") == "" {
		t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	}
	if os.Getenv("LCP_RUNTIME_MODE") == "" {
		t.Setenv("LCP_RUNTIME_MODE", string(LCPRuntimeModeLocal))
	}
	if os.Getenv("LCP_LOCAL_BACKEND") == "" {
		t.Setenv("LCP_LOCAL_BACKEND", string(LCPPersistentBackendCloudStorage))
	}
	t.Setenv("LCP_STORAGE_GCS_USE_USER_PROJECT", "true")
}

func assertCloudStorageBackendConfig(t *testing.T, store PersistentCacheStore[map[string]any], cfg EnvironmentPersistentStoreConfig) {
	t.Helper()
	if store == nil {
		t.Fatalf("expected persistent store")
	}
	if cfg.Backend != LCPPersistentBackendCloudStorage {
		t.Fatalf("expected cloud-storage backend, got %s", cfg.Backend)
	}
	if cfg.CloudStorageURI == "" {
		t.Fatalf("expected non-empty CloudStorageURI for cloud-storage backend")
	}
}

func assertLoadedValue(t *testing.T, store PersistentCacheStore[map[string]any], cacheKey string, payload map[string]any) {
	t.Helper()
	loaded, err := store.Get(cacheKey)
	if err != nil {
		t.Fatalf("get cache entry: %v", err)
	}
	if loaded == nil {
		t.Fatalf("expected loaded entry for key %s", cacheKey)
	}
	if loaded.CacheKey != cacheKey {
		t.Fatalf("cache key mismatch: expected %s got %s", cacheKey, loaded.CacheKey)
	}
	if loaded.Data["value"] != payload["value"] {
		t.Fatalf("value mismatch: expected %v got %v", payload["value"], loaded.Data["value"])
	}
}
