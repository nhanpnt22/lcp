package lcp

import (
	"path/filepath"
	"testing"
)

func mustH57Key(t *testing.T, label string) string {
	t.Helper()
	key, err := ComputeCacheKey(CacheKeyInput{
		Namespace:     "contract",
		OperationID:   label,
		Payload:       map[string]any{"suite": "persistent-store", "label": label},
		SchemaVersion: "v1",
		SpecChecksum:  "spec-v1",
		UserScope:     "test-user",
	}, H57HashFn)
	if err != nil {
		t.Fatalf("compute H57 key %s: %v", label, err)
	}
	return key
}

func testEntry(key string, value any, createdAt int64, ttlMS int64) CacheEntry[map[string]any] {
	return CacheEntry[map[string]any]{
		CacheKey: key,
		Data:     map[string]any{"value": value},
		Metadata: CreateCacheMetadata(CacheSourceAPI, createdAt, ttlMS, "v1", "v1", "spec", "ns", false),
	}
}

type storeFactory struct {
	name     string
	create   func(t *testing.T) PersistentCacheStore[map[string]any]
	teardown func(PersistentCacheStore[map[string]any])
}

func persistentStoreFactories() []storeFactory {
	return []storeFactory{
		{
			name: "memory",
			create: func(t *testing.T) PersistentCacheStore[map[string]any] {
				t.Helper()
				return NewInMemoryPersistentStore[map[string]any]()
			},
		},
		{
			name: "sqlite",
			create: func(t *testing.T) PersistentCacheStore[map[string]any] {
				t.Helper()
				store, err := NewSQLitePersistentStore[map[string]any](filepath.Join(t.TempDir(), "lcp-cache.db"))
				if err != nil {
					t.Fatalf("unexpected err: %v", err)
				}
				return store
			},
			teardown: func(store PersistentCacheStore[map[string]any]) {
				if sqliteStore, ok := store.(*SQLitePersistentStore[map[string]any]); ok {
					_ = sqliteStore.Close()
				}
			},
		},
	}
}

func runPerStore(t *testing.T, testName string, run func(t *testing.T, store PersistentCacheStore[map[string]any])) {
	t.Helper()
	for _, f := range persistentStoreFactories() {
		f := f
		t.Run(testName+"/"+f.name, func(t *testing.T) {
			store := f.create(t)
			if f.teardown != nil {
				defer f.teardown(store)
			}
			run(t, store)
		})
	}
}

func mustSet(t *testing.T, store PersistentCacheStore[map[string]any], entry CacheEntry[map[string]any]) {
	t.Helper()
	if err := store.Set(entry); err != nil {
		t.Fatalf("set failed: %v", err)
	}
}

func mustGet(t *testing.T, store PersistentCacheStore[map[string]any], key string) *CacheEntry[map[string]any] {
	t.Helper()
	got, err := store.Get(key)
	if err != nil {
		t.Fatalf("get failed: %v", err)
	}
	return got
}

func assertValue(t *testing.T, got *CacheEntry[map[string]any], want string) {
	t.Helper()
	if got == nil || got.Data["value"] != want {
		t.Fatalf("expected value %s, got %+v", want, got)
	}
}

func TestPersistentStoreContractSetGetValue(t *testing.T) {
	runPerStore(t, "set_get_value", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key := mustH57Key(t, "k1")
		mustSet(t, store, testEntry(key, "alpha", 1000, 10000))
		assertValue(t, mustGet(t, store, key), "alpha")
	})
}

func TestPersistentStoreContractOverwrite(t *testing.T) {
	runPerStore(t, "overwrite", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key := mustH57Key(t, "k1")
		mustSet(t, store, testEntry(key, "alpha", 1000, 10000))
		mustSet(t, store, testEntry(key, "beta", 1000, 10000))
		assertValue(t, mustGet(t, store, key), "beta")
	})
}

func TestPersistentStoreContractDelete(t *testing.T) {
	runPerStore(t, "delete", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key := mustH57Key(t, "k1")
		mustSet(t, store, testEntry(key, "alpha", 1000, 10000))
		if err := store.Delete(key); err != nil {
			t.Fatalf("delete failed: %v", err)
		}
		if got := mustGet(t, store, key); got != nil {
			t.Fatalf("expected nil after delete, got %+v", got)
		}
	})
}

func TestPersistentStoreContractClear(t *testing.T) {
	runPerStore(t, "clear", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key1 := mustH57Key(t, "k1")
		key2 := mustH57Key(t, "k2")
		mustSet(t, store, testEntry(key1, "alpha", 1000, 10000))
		mustSet(t, store, testEntry(key2, "beta", 1000, 10000))
		if err := store.Clear(); err != nil {
			t.Fatalf("clear failed: %v", err)
		}
		if got := mustGet(t, store, key1); got != nil {
			t.Fatalf("expected nil after clear for k1, got %+v", got)
		}
		if got := mustGet(t, store, key2); got != nil {
			t.Fatalf("expected nil after clear for k2, got %+v", got)
		}
	})
}

func TestPersistentStoreContractPruneExpired(t *testing.T) {
	runPerStore(t, "prune_expired", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		expiredKey := mustH57Key(t, "expired")
		validKey := mustH57Key(t, "valid")
		mustSet(t, store, testEntry(expiredKey, "old", 1000, 100))
		mustSet(t, store, testEntry(validKey, "new", 1000, 10000))

		removed, err := store.PruneExpired(5000)
		if err != nil {
			t.Fatalf("prune failed: %v", err)
		}
		if removed != 1 {
			t.Fatalf("expected 1 removed, got %d", removed)
		}

		if got := mustGet(t, store, expiredKey); got != nil {
			t.Fatalf("expected expired removed, got %+v", got)
		}
		assertValue(t, mustGet(t, store, validKey), "new")
	})
}

func TestPersistentStoreContractHydrateAllValidAndLimit(t *testing.T) {
	runPerStore(t, "hydrate_valid_limit", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		keyA := mustH57Key(t, "a")
		keyB := mustH57Key(t, "b")
		expiredKey := mustH57Key(t, "expired")
		mustSet(t, store, testEntry(keyA, "va", 1000, 10000))
		mustSet(t, store, testEntry(keyB, "vb", 1000, 10000))
		mustSet(t, store, testEntry(expiredKey, "vx", 1000, 100))

		all, err := store.HydrateAllValid(5000, nil)
		if err != nil {
			t.Fatalf("hydrate all failed: %v", err)
		}
		if len(all) != 2 {
			t.Fatalf("expected 2 valid entries, got %d", len(all))
		}

		limit := 1
		limited, err := store.HydrateAllValid(5000, &limit)
		if err != nil {
			t.Fatalf("hydrate limited failed: %v", err)
		}
		if len(limited) != 1 {
			t.Fatalf("expected 1 limited entry, got %d", len(limited))
		}
	})
}
