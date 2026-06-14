package lcp

import (
	"fmt"
	"os"
	"strconv"
	"testing"
)

func benchN(defaultN int) int {
	if raw := os.Getenv("BENCH_N"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil {
			return n
		}
	}
	return defaultN
}

func benchKeys(b *testing.B, n int) []string {
	b.Helper()
	keys := make([]string, n)
	for i := 0; i < n; i++ {
		key, err := ComputeCacheKey(CacheKeyInput{
			Namespace:     "bench",
			OperationID:   fmt.Sprintf("key-%d", i),
			Payload:       map[string]any{"i": i},
			SchemaVersion: "v1",
			SpecChecksum:  "spec-v1",
			UserScope:     "bench-user",
		}, H57HashFn)
		if err != nil {
			b.Fatalf("compute h57 key: %v", err)
		}
		keys[i] = key
	}
	return keys
}

func benchEntry(key string, i int) CacheEntry[map[string]any] {
	return CacheEntry[map[string]any]{
		CacheKey: key,
		Data:     map[string]any{"value": fmt.Sprintf("payload-%d", i), "i": i},
		Metadata: CreateCacheMetadata(CacheSourceAPI, 1000, 86_400_000, "v1", "v1", "spec", "ns", false),
	}
}

func BenchmarkFilePersistentStore_10000(b *testing.B) {
	n := benchN(10000)
	keys := benchKeys(b, n)

	for i := 0; i < b.N; i++ {
		root := b.TempDir()
		store, err := NewFilePersistentStore[map[string]any](root)
		if err != nil {
			b.Fatalf("create file store: %v", err)
		}

		writeStart := nowMS()
		for j, key := range keys {
			if err := store.Set(benchEntry(key, j)); err != nil {
				b.Fatalf("set: %v", err)
			}
		}
		writeMs := nowMS() - writeStart

		readStart := nowMS()
		for _, key := range keys {
			if _, err := store.Get(key); err != nil {
				b.Fatalf("get: %v", err)
			}
		}
		readMs := nowMS() - readStart

		b.ReportMetric(float64(writeMs), "write_ms")
		b.ReportMetric(float64(readMs), "read_ms")
	}
}

func BenchmarkSQLitePersistentStore_10000(b *testing.B) {
	n := benchN(10000)
	keys := benchKeys(b, n)

	for i := 0; i < b.N; i++ {
		root := b.TempDir()
		store, err := NewSQLitePersistentStore[map[string]any](root + "/bench.db")
		if err != nil {
			b.Fatalf("create sqlite store: %v", err)
		}

		writeStart := nowMS()
		for j, key := range keys {
			if err := store.Set(benchEntry(key, j)); err != nil {
				b.Fatalf("set: %v", err)
			}
		}
		writeMs := nowMS() - writeStart

		readStart := nowMS()
		for _, key := range keys {
			if _, err := store.Get(key); err != nil {
				b.Fatalf("get: %v", err)
			}
		}
		readMs := nowMS() - readStart

		b.ReportMetric(float64(writeMs), "write_ms")
		b.ReportMetric(float64(readMs), "read_ms")
	}
}
