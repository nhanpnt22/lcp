package lcp

import "testing"

func TestLoadEnvironmentPersistentStoreConfigAllowsLocalCloudStorage(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "cloud-storage")
	t.Setenv("LCP_STORAGE_GCS_URI", "gs://aiptesting.firebasestorage.app/lcp")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected validation err: %v", err)
	}
	if cfg.Backend != LCPPersistentBackendCloudStorage {
		t.Fatalf("expected cloud-storage backend selection, got %s", cfg.Backend)
	}
}

func TestLoadEnvironmentPersistentStoreConfigUsesStorageBackendForLocalWhenLocalUnset(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "")
	t.Setenv("LCP_STORAGE_BACKEND", "cloud-storage")
	t.Setenv("LCP_STORAGE_GCS_URI", "gs://aiptesting.firebasestorage.app/lcp")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected validation err: %v", err)
	}
	if cfg.Backend != LCPPersistentBackendCloudStorage {
		t.Fatalf("expected cloud-storage backend selection from LCP_STORAGE_BACKEND, got %s", cfg.Backend)
	}
}

func TestLoadEnvironmentPersistentStoreConfigRejectsMissingCloudStorageURIForLocal(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "cloud-storage")
	t.Setenv("LCP_STORAGE_GCS_URI", "")
	t.Setenv("LCP_STORAGE_BUCKET_URI", "")

	_, err := LoadEnvironmentPersistentStoreConfig()
	if err == nil {
		t.Fatalf("expected validation error for missing LCP_STORAGE_GCS_URI in cloud-storage backend")
	}
}

func TestLoadEnvironmentPersistentStoreConfigDerivesStorageURIFromBucketURI(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "")
	t.Setenv("LCP_STORAGE_BACKEND", "cloud-storage")
	t.Setenv("LCP_STORAGE_GCS_URI", "")
	t.Setenv("LCP_STORAGE_BUCKET_URI", "gs://aiptesting.firebasestorage.app")
	t.Setenv("LCP_CACHE_PATH", "derived-cache")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected validation err: %v", err)
	}
	if cfg.CloudStorageURI != "gs://aiptesting.firebasestorage.app/derived-cache" {
		t.Fatalf("expected derived cloud storage URI, got %q", cfg.CloudStorageURI)
	}
}

func TestLoadEnvironmentPersistentStoreConfigRejectsInvalidStorageURI(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "cloud-storage")
	t.Setenv("LCP_STORAGE_GCS_URI", "https://invalid")

	_, err := LoadEnvironmentPersistentStoreConfig()
	if err == nil {
		t.Fatalf("expected validation error for invalid LCP_STORAGE_GCS_URI")
	}
}

func TestLoadEnvironmentPersistentStoreConfigCloudStorageUserProjectDefaultsFalse(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "cloud-storage")
	t.Setenv("LCP_STORAGE_GCS_URI", "gs://aiptesting.firebasestorage.app/lcp")
	t.Setenv("LCP_STORAGE_GCS_USE_USER_PROJECT", "")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected validation err: %v", err)
	}
	if cfg.CloudStorageUseUserProject {
		t.Fatalf("expected CloudStorageUseUserProject=false by default")
	}
}

func TestLoadEnvironmentPersistentStoreConfigCloudStorageUserProjectTrue(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "cloud-storage")
	t.Setenv("LCP_STORAGE_GCS_URI", "gs://aiptesting.firebasestorage.app/lcp")
	t.Setenv("LCP_STORAGE_GCS_USE_USER_PROJECT", "true")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected validation err: %v", err)
	}
	if !cfg.CloudStorageUseUserProject {
		t.Fatalf("expected CloudStorageUseUserProject=true when env enabled")
	}
}
