package lcp

import "testing"

func mustTestH57Key(t *testing.T, label string) string {
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

func TestMemoryStoreGetRemovesExpired(t *testing.T) {
	now := int64(1000)
	store := NewMemoryCacheStore[map[string]any](4, func() int64 { return now })
	key := mustTestH57Key(t, "k1")
	entry := CacheEntry[map[string]any]{
		CacheKey: key,
		Data:     map[string]any{"name": "alice"},
		Metadata: CreateCacheMetadata(CacheSourceAPI, 0, 10, "v1", "v1", "spec", "ns", false),
	}
	store.Set(entry)

	now = 20
	got := store.Get(key)
	if got != nil {
		t.Fatalf("expected expired entry to be nil")
	}
	peek := store.Peek(key)
	if peek != nil {
		t.Fatalf("expected expired entry to be removed")
	}
}

func expectPanic(t *testing.T, name string, run func()) {
	t.Helper()
	defer func() {
		if r := recover(); r == nil {
			t.Fatalf("expected panic for %s", name)
		}
	}()
	run()
}

func TestMemoryStorePanicsOnInvalidKeyOperations(t *testing.T) {
	store := NewMemoryCacheStore[map[string]any](4, func() int64 { return 1000 })
	validKey := mustTestH57Key(t, "valid")

	store.Set(CacheEntry[map[string]any]{
		CacheKey: validKey,
		Data:     map[string]any{"name": "alice"},
		Metadata: CreateCacheMetadata(CacheSourceAPI, 1000, 1000, "v1", "v1", "spec", "ns", false),
	})

	expectPanic(t, "get", func() {
		_ = store.Get("not-h57")
	})

	expectPanic(t, "peek", func() {
		_ = store.Peek("not-h57")
	})

	expectPanic(t, "set", func() {
		store.Set(CacheEntry[map[string]any]{
			CacheKey: "not-h57",
			Data:     map[string]any{"name": "bob"},
			Metadata: CreateCacheMetadata(CacheSourceAPI, 1000, 1000, "v1", "v1", "spec", "ns", false),
		})
	})

	expectPanic(t, "delete", func() {
		store.Delete("not-h57")
	})
}
