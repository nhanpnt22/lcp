package lcp

import "testing"

func mustSQLiteTestH57Key(t *testing.T, label string) string {
	t.Helper()
	key, err := ComputeCacheKey(CacheKeyInput{
		Namespace:     "test",
		OperationID:   label,
		Payload:       map[string]any{"label": label},
		SchemaVersion: "v1",
		SpecChecksum:  "spec-v1",
		UserScope:     "test-user",
	}, H57HashFn)
	if err != nil {
		t.Fatalf("compute h57 key: %v", err)
	}
	return key
}

func TestSQLitePersistentStoreRoundTrip(t *testing.T) {
	store, err := NewSQLitePersistentStore[map[string]any](t.TempDir() + "/lcp-cache.db")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	defer func() { _ = store.Close() }()
	key := mustSQLiteTestH57Key(t, "k1")

	entry := CacheEntry[map[string]any]{
		CacheKey: key,
		Data:     map[string]any{"value": "alpha"},
		Metadata: CreateCacheMetadata(CacheSourceAPI, 1000, 5000, "v1", "v1", "spec", "ns", false),
	}
	if err := store.Set(entry); err != nil {
		t.Fatalf("unexpected set err: %v", err)
	}
	loaded, err := store.Get(key)
	if err != nil {
		t.Fatalf("unexpected get err: %v", err)
	}
	if loaded == nil || loaded.Data["value"] != "alpha" {
		t.Fatalf("expected cached entry round-trip")
	}
}

func TestSQLitePersistentStorePruneExpired(t *testing.T) {
	store, err := NewSQLitePersistentStore[map[string]any](t.TempDir() + "/lcp-cache.db")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	defer func() { _ = store.Close() }()
	expiredKey := mustSQLiteTestH57Key(t, "expired")
	validKey := mustSQLiteTestH57Key(t, "valid")

	if err := store.Set(CacheEntry[map[string]any]{
		CacheKey: expiredKey,
		Data:     map[string]any{"v": 1},
		Metadata: CreateCacheMetadata(CacheSourceAPI, 1000, 100, "v1", "v1", "spec", "ns", false),
	}); err != nil {
		t.Fatalf("unexpected set err: %v", err)
	}
	if err := store.Set(CacheEntry[map[string]any]{
		CacheKey: validKey,
		Data:     map[string]any{"v": 2},
		Metadata: CreateCacheMetadata(CacheSourceAPI, 1000, 10000, "v1", "v1", "spec", "ns", false),
	}); err != nil {
		t.Fatalf("unexpected set err: %v", err)
	}

	removed, err := store.PruneExpired(5000)
	if err != nil {
		t.Fatalf("unexpected prune err: %v", err)
	}
	if removed != 1 {
		t.Fatalf("expected 1 removed entry, got %d", removed)
	}
	entry, err := store.Get(expiredKey)
	if err != nil {
		t.Fatalf("unexpected get err: %v", err)
	}
	if entry != nil {
		t.Fatalf("expected expired entry to be removed")
	}
}
