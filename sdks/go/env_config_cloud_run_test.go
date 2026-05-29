package lcp

import "testing"

func TestLoadEnvironmentPersistentStoreConfigAllowsCloudRunSQLiteStorage(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "cloud-run")
	t.Setenv("LCP_CLOUD_RUN_BACKEND_PREFERENCE", "storage")
	t.Setenv("LCP_IN_MEMORY_BACKEND", "in-memory")
	t.Setenv("LCP_STORAGE_BACKEND", "sqlite")
	t.Setenv("LCP_SQLITE_PATH", t.TempDir()+"/cache.db")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected validation err: %v", err)
	}
	if cfg.Backend != LCPPersistentBackendSQLite {
		t.Fatalf("expected sqlite backend, got %s", cfg.Backend)
	}
}

func TestLoadEnvironmentPersistentStoreConfigRejectsInvalidCloudRunInMemoryBackend(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "cloud-run")
	t.Setenv("LCP_IN_MEMORY_BACKEND", "sqlite")
	t.Setenv("LCP_STORAGE_BACKEND", "cloud-storage")
	t.Setenv("LCP_STORAGE_GCS_URI", "gs://aiptesting.firebasestorage.app/lcp")

	_, err := LoadEnvironmentPersistentStoreConfig()
	if err == nil {
		t.Fatalf("expected validation error for in-memory backend")
	}
}

func TestCloudRunBackendPreferenceSelectionTable(t *testing.T) {
	tests := []struct {
		name            string
		preference      string
		inMemoryBackend string
		storageBackend  string
		expectedBackend LCPPersistentBackend
		setStorageURI   bool
	}{
		{
			name:            "storage preferred selects cloud storage",
			preference:      "storage",
			inMemoryBackend: "in-memory",
			storageBackend:  "cloud-storage",
			expectedBackend: LCPPersistentBackendCloudStorage,
			setStorageURI:   true,
		},
		{
			name:            "in-memory preferred selects in-memory",
			preference:      "in-memory",
			inMemoryBackend: "in-memory",
			storageBackend:  "cloud-storage",
			expectedBackend: LCPPersistentBackendInMemory,
			setStorageURI:   true,
		},
		{
			name:            "storage preferred selects sqlite",
			preference:      "storage",
			inMemoryBackend: "in-memory",
			storageBackend:  "sqlite",
			expectedBackend: LCPPersistentBackendSQLite,
			setStorageURI:   false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("LCP_PERSISTENT_ENABLED", "true")
			t.Setenv("LCP_RUNTIME_MODE", "cloud-run")
			t.Setenv("LCP_CLOUD_RUN_BACKEND_PREFERENCE", tc.preference)
			t.Setenv("LCP_IN_MEMORY_BACKEND", tc.inMemoryBackend)
			t.Setenv("LCP_STORAGE_BACKEND", tc.storageBackend)
			t.Setenv("LCP_SQLITE_PATH", t.TempDir()+"/cache.db")
			if tc.setStorageURI {
				t.Setenv("LCP_STORAGE_GCS_URI", "gs://aiptesting.firebasestorage.app/lcp")
			}

			cfg, err := LoadEnvironmentPersistentStoreConfig()
			if err != nil {
				t.Fatalf("unexpected validation err: %v", err)
			}
			if cfg.Backend != tc.expectedBackend {
				t.Fatalf("expected backend %s, got %s", tc.expectedBackend, cfg.Backend)
			}
		})
	}
}

func TestCloudRunRejectsUnsupportedStorageBackend(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "cloud-run")
	t.Setenv("LCP_CLOUD_RUN_BACKEND_PREFERENCE", "storage")
	t.Setenv("LCP_IN_MEMORY_BACKEND", "in-memory")
	t.Setenv("LCP_STORAGE_BACKEND", "off")

	_, err := LoadEnvironmentPersistentStoreConfig()
	if err == nil {
		t.Fatalf("expected validation error for unsupported storage backend")
	}
}
