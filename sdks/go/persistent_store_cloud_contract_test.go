package lcp

import "testing"

func TestPersistentStoreCloudContractSetGetValue(t *testing.T) {
	runPerCloudStore(t, "set_get_value", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key := mustH57CloudKey(t, "k1")
		mustCloudSet(t, store, cloudContractEntry(key, "alpha", 1000, 10000))
		assertCloudValue(t, mustCloudGet(t, store, key), "alpha")
	})
}

func TestPersistentStoreCloudContractOverwrite(t *testing.T) {
	runPerCloudStore(t, "overwrite", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key := mustH57CloudKey(t, "k1")
		mustCloudSet(t, store, cloudContractEntry(key, "alpha", 1000, 10000))
		mustCloudSet(t, store, cloudContractEntry(key, "beta", 1000, 10000))
		assertCloudValue(t, mustCloudGet(t, store, key), "beta")
	})
}

func TestPersistentStoreCloudContractDelete(t *testing.T) {
	runPerCloudStore(t, "delete", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key := mustH57CloudKey(t, "k1")
		mustCloudSet(t, store, cloudContractEntry(key, "alpha", 1000, 10000))
		if err := store.Delete(key); err != nil {
			t.Fatalf("delete failed: %v", err)
		}
		if got := mustCloudGet(t, store, key); got != nil {
			t.Fatalf("expected nil after delete, got %+v", got)
		}
	})
}

func TestPersistentStoreCloudContractClear(t *testing.T) {
	runPerCloudStore(t, "clear", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key1 := mustH57CloudKey(t, "k1")
		key2 := mustH57CloudKey(t, "k2")
		mustCloudSet(t, store, cloudContractEntry(key1, "alpha", 1000, 10000))
		mustCloudSet(t, store, cloudContractEntry(key2, "beta", 1000, 10000))
		if err := store.Clear(); err != nil {
			t.Fatalf("clear failed: %v", err)
		}
		if got := mustCloudGet(t, store, key1); got != nil {
			t.Fatalf("expected nil after clear for k1, got %+v", got)
		}
		if got := mustCloudGet(t, store, key2); got != nil {
			t.Fatalf("expected nil after clear for k2, got %+v", got)
		}
	})
}

func TestPersistentStoreCloudContractPruneExpired(t *testing.T) {
	runPerCloudStore(t, "prune_expired", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		expiredKey := mustH57CloudKey(t, "expired")
		validKey := mustH57CloudKey(t, "valid")
		mustCloudSet(t, store, cloudContractEntry(expiredKey, "old", 1000, 100))
		mustCloudSet(t, store, cloudContractEntry(validKey, "new", 1000, 10000))

		removed, err := store.PruneExpired(5000)
		if err != nil {
			t.Fatalf("prune failed: %v", err)
		}
		if removed != 1 {
			t.Fatalf("expected 1 removed, got %d", removed)
		}

		if got := mustCloudGet(t, store, expiredKey); got != nil {
			t.Fatalf("expected expired removed, got %+v", got)
		}
		assertCloudValue(t, mustCloudGet(t, store, validKey), "new")
	})
}

func TestPersistentStoreCloudContractHydrateAllValidAndLimit(t *testing.T) {
	runPerCloudStore(t, "hydrate_valid_limit", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		keyA := mustH57CloudKey(t, "a")
		keyB := mustH57CloudKey(t, "b")
		expiredKey := mustH57CloudKey(t, "expired")
		mustCloudSet(t, store, cloudContractEntry(keyA, "va", 1000, 10000))
		mustCloudSet(t, store, cloudContractEntry(keyB, "vb", 1000, 10000))
		mustCloudSet(t, store, cloudContractEntry(expiredKey, "vx", 1000, 100))

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

func TestPersistentStoreCloudContractSetVisibleValueEvidence(t *testing.T) {
	runPerCloudStore(t, "set_visible_value_evidence", func(t *testing.T, store PersistentCacheStore[map[string]any]) {
		key := mustH57CloudKey(t, "visible-evidence")
		mustCloudSet(t, store, cloudContractEntry(key, "alpha", 1000, 86400000))

		if got := mustCloudGet(t, store, key); got == nil {
			t.Fatalf("expected visible evidence entry to exist")
		} else {
			assertCloudValue(t, got, "alpha")
		}
	})
}
