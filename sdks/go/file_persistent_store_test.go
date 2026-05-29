package lcp

import (
	"path/filepath"
	"testing"
)

func mustFileTestH57Key(t *testing.T, label string) string {
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

func TestFilePersistentStoreRoundTrip(t *testing.T) {
	root := t.TempDir()
	store, err := NewFilePersistentStore[map[string]any](root)
	if err != nil {
		t.Fatalf("create file store: %v", err)
	}
	key := mustFileTestH57Key(t, "key-1")
	entry := CacheEntry[map[string]any]{
		CacheKey: key,
		Data:     map[string]any{"name": "alice"},
		Metadata: CreateCacheMetadata(CacheSourceAPI, 1000, 60000, "v1", "v1", "spec", "ns", false),
	}
	if err := store.Set(entry); err != nil {
		t.Fatalf("set: %v", err)
	}
	got, err := store.Get(key)
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got == nil || got.Data["name"] != "alice" {
		t.Fatalf("unexpected entry data: %#v", got)
	}
}

func TestFilePersistentStorePruneExpired(t *testing.T) {
	root := t.TempDir()
	store, err := NewFilePersistentStore[map[string]any](root)
	if err != nil {
		t.Fatalf("create file store: %v", err)
	}
	expiredKey := mustFileTestH57Key(t, "expired")
	validKey := mustFileTestH57Key(t, "valid")
	entries := []CacheEntry[map[string]any]{
		{CacheKey: expiredKey, Data: map[string]any{"v": 1}, Metadata: CreateCacheMetadata(CacheSourceAPI, 0, 10, "v1", "v1", "spec", "ns", false)},
		{CacheKey: validKey, Data: map[string]any{"v": 2}, Metadata: CreateCacheMetadata(CacheSourceAPI, 0, 1000, "v1", "v1", "spec", "ns", false)},
	}
	for _, entry := range entries {
		if err := store.Set(entry); err != nil {
			t.Fatalf("set: %v", err)
		}
	}
	removed, err := store.PruneExpired(100)
	if err != nil {
		t.Fatalf("prune: %v", err)
	}
	if removed != 1 {
		t.Fatalf("expected 1 removed, got %d", removed)
	}
	if got, _ := store.Get(expiredKey); got != nil {
		t.Fatalf("expected expired entry removed")
	}
	if got, _ := store.Get(validKey); got == nil {
		t.Fatalf("expected valid entry kept")
	}
}

func TestFilePersistentStoreHydrateLimit(t *testing.T) {
	root := t.TempDir()
	store, err := NewFilePersistentStore[map[string]any](root)
	if err != nil {
		t.Fatalf("create file store: %v", err)
	}
	for i := 0; i < 3; i++ {
		key := mustFileTestH57Key(t, filepath.Base(root)+"-"+string(rune('a'+i)))
		entry := CacheEntry[map[string]any]{
			CacheKey: key,
			Data:     map[string]any{"i": i},
			Metadata: CreateCacheMetadata(CacheSourceAPI, 0, 1000, "v1", "v1", "spec", "ns", false),
		}
		if err := store.Set(entry); err != nil {
			t.Fatalf("set: %v", err)
		}
	}
	limit := 2
	items, err := store.HydrateAllValid(100, &limit)
	if err != nil {
		t.Fatalf("hydrate: %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(items))
	}
}
