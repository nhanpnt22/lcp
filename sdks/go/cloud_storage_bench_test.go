package lcp

import (
	"os"
	"testing"
)

func BenchmarkCloudStoragePersistentStore_500(t *testing.B) {
	if os.Getenv("STORAGE_EMULATOR_HOST") == "" {
		t.Skip("STORAGE_EMULATOR_HOST not set; skipping cloud storage benchmark")
	}

	const n = 500
	keys := benchKeys(t, n)

	store, err := NewCloudStoragePersistentStore[map[string]any]("lcp-bench-bucket", "bench-go", CloudStoragePersistentStoreOptions{
		ProjectID: "lcp-bench",
	})
	if err != nil {
		t.Fatalf("create cloud storage store: %v", err)
	}
	defer func() { _ = store.Clear() }()

	for i := 0; i < t.N; i++ {
		writeStart := nowMS()
		for j, key := range keys {
			if err := store.Set(benchEntry(key, j)); err != nil {
				t.Fatalf("set: %v", err)
			}
		}
		writeMs := nowMS() - writeStart

		readStart := nowMS()
		for _, key := range keys {
			if _, err := store.Get(key); err != nil {
				t.Fatalf("get: %v", err)
			}
		}
		readMs := nowMS() - readStart

		t.ReportMetric(float64(writeMs), "write_ms")
		t.ReportMetric(float64(readMs), "read_ms")
	}
}
