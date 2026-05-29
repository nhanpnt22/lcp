package lcp

import "testing"

func TestNewCloudRunPersistentStoreInMemory(t *testing.T) {
	store, err := NewCloudRunPersistentStore[map[string]any](CloudRunPersistentModeInMemory, CloudRunPersistentStoreOptions{})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if store == nil {
		t.Fatalf("expected store")
	}
}

func TestNewCloudRunPersistentStoreSQLiteRequiresPath(t *testing.T) {
	_, err := NewCloudRunPersistentStore[map[string]any](CloudRunPersistentModeSQLite, CloudRunPersistentStoreOptions{})
	if err == nil {
		t.Fatalf("expected error when sqlite path missing")
	}
}

func TestNewCloudRunPersistentStoreSQLite(t *testing.T) {
	store, err := NewCloudRunPersistentStore[map[string]any](CloudRunPersistentModeSQLite, CloudRunPersistentStoreOptions{
		SQLitePath: t.TempDir() + "/cache.db",
	})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if store == nil {
		t.Fatalf("expected store")
	}
}

func TestNewCloudRunPersistentStoreCloudStorageRequiresURI(t *testing.T) {
	_, err := NewCloudRunPersistentStore[map[string]any](CloudRunPersistentModeCloud, CloudRunPersistentStoreOptions{})
	if err == nil {
		t.Fatalf("expected error when cloud storage URI missing")
	}
}

func TestNewCloudRunPersistentStoreRejectsInvalidMode(t *testing.T) {
	_, err := NewCloudRunPersistentStore[map[string]any](CloudRunPersistentMode("unknown"), CloudRunPersistentStoreOptions{})
	if err != nil {
		return
	}
	t.Fatalf("expected error when mode is unsupported")
}
