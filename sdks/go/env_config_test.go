package lcp

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewPersistentStoreFromEnvLocalSQLite(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "sqlite")
	t.Setenv("LCP_SQLITE_PATH", t.TempDir()+"/cache.db")

	store, cfg, err := NewPersistentStoreFromEnv[map[string]any]()
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if store == nil {
		t.Fatalf("expected store")
	}
	if cfg.RuntimeMode != LCPRuntimeModeLocal || cfg.Backend != LCPPersistentBackendSQLite {
		t.Fatalf("unexpected config: runtime=%s backend=%s", cfg.RuntimeMode, cfg.Backend)
	}
}

func TestNewPersistentStoreFromEnvDisabled(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "false")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "in-memory")

	store, cfg, err := NewPersistentStoreFromEnv[map[string]any]()
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if store != nil {
		t.Fatalf("expected nil store when disabled")
	}
	if cfg.Enabled {
		t.Fatalf("expected config disabled")
	}
}

func TestLoadEnvironmentPersistentStoreConfigReadsPersistenceModeAndThreshold(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "sqlite")
	t.Setenv("LCP_SQLITE_PATH", t.TempDir()+"/cache.db")
	t.Setenv("LCP_PERSISTENCE_MODE", "auto")
	t.Setenv("LCP_PERSISTENCE_SHORT_THRESHOLD_MS", "123456")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if cfg.PersistenceMode != CachePersistenceAuto {
		t.Fatalf("expected auto persistence mode, got %s", cfg.PersistenceMode)
	}
	if cfg.ShortThresholdMS != 123456 {
		t.Fatalf("expected short threshold 123456, got %d", cfg.ShortThresholdMS)
	}
}

func TestLoadEnvironmentPersistentStoreConfigRejectsInvalidPersistenceMode(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "sqlite")
	t.Setenv("LCP_SQLITE_PATH", t.TempDir()+"/cache.db")
	t.Setenv("LCP_PERSISTENCE_MODE", "invalid-mode")

	_, err := LoadEnvironmentPersistentStoreConfig()
	if err == nil {
		t.Fatalf("expected validation error for persistence mode")
	}
}

func TestLoadEnvironmentPersistentStoreConfigUsesStorageSQLiteForLocalWhenLocalUnset(t *testing.T) {
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "")
	t.Setenv("LCP_STORAGE_BACKEND", "sqlite")
	t.Setenv("LCP_SQLITE_PATH", t.TempDir()+"/cache.db")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected validation err: %v", err)
	}
	if cfg.Backend != LCPPersistentBackendSQLite {
		t.Fatalf("expected sqlite backend selection from LCP_STORAGE_BACKEND, got %s", cfg.Backend)
	}
}

func TestLoadEnvironmentPersistentStoreConfigDerivesSQLitePathFromGeneralCachePath(t *testing.T) {
	root := t.TempDir()
	t.Setenv("LCP_PERSISTENT_ENABLED", "true")
	t.Setenv("LCP_RUNTIME_MODE", "local")
	t.Setenv("LCP_LOCAL_BACKEND", "")
	t.Setenv("LCP_STORAGE_BACKEND", "sqlite")
	t.Setenv("LCP_SQLITE_PATH", "")
	t.Setenv("LCP_LOCAL_CACHE_ROOT", root)
	t.Setenv("LCP_CACHE_PATH", "shared-cache")

	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		t.Fatalf("unexpected validation err: %v", err)
	}

	expectedSQLite := filepath.Join(root, "shared-cache", "lcp_cache.db")
	if cfg.SQLitePath != expectedSQLite {
		t.Fatalf("expected sqlite path %q, got %q", expectedSQLite, cfg.SQLitePath)
	}
}

func TestEnvBoolFallback(t *testing.T) {
	key := "LCP_TEST_BOOL"
	_ = os.Unsetenv(key)
	if !envBool(key, true) {
		t.Fatalf("expected fallback true")
	}
	os.Setenv(key, "invalid")
	if !envBool(key, true) {
		t.Fatalf("expected fallback true on invalid bool")
	}
}
