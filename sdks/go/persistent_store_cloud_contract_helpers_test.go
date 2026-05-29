package lcp

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"
)

type cloudStoreFactory struct {
	name     string
	create   func(t *testing.T) PersistentCacheStore[map[string]any]
	teardown func(t *testing.T, store PersistentCacheStore[map[string]any])
}

func mustH57CloudKey(t *testing.T, label string) string {
	t.Helper()
	key, err := ComputeCacheKey(CacheKeyInput{
		Namespace:     "contract",
		OperationID:   label,
		Payload:       map[string]any{"suite": "persistent-store-cloud", "label": label},
		SchemaVersion: "v1",
		SpecChecksum:  "spec-v1",
		UserScope:     "test-user",
	}, H57HashFn)
	if err != nil {
		t.Fatalf("compute H57 key %s: %v", label, err)
	}
	return key
}

func cloudContractEntry(key string, value any, createdAt int64, ttlMS int64) CacheEntry[map[string]any] {
	return CacheEntry[map[string]any]{
		CacheKey: key,
		Data:     map[string]any{"value": value},
		Metadata: CreateCacheMetadata(CacheSourceAPI, createdAt, ttlMS, "v1", "v1", "spec", "ns", false),
	}
}

func mustCloudSet(t *testing.T, store PersistentCacheStore[map[string]any], entry CacheEntry[map[string]any]) {
	t.Helper()
	if err := store.Set(entry); err != nil {
		t.Fatalf("set failed: %v", err)
	}
}

func mustCloudGet(t *testing.T, store PersistentCacheStore[map[string]any], key string) *CacheEntry[map[string]any] {
	t.Helper()
	got, err := store.Get(key)
	if err != nil {
		t.Fatalf("get failed: %v", err)
	}
	return got
}

func assertCloudValue(t *testing.T, got *CacheEntry[map[string]any], want string) {
	t.Helper()
	if got == nil || got.Data["value"] != want {
		t.Fatalf("expected value %s, got %+v", want, got)
	}
}

func runPerCloudStore(t *testing.T, name string, run func(t *testing.T, store PersistentCacheStore[map[string]any])) {
	t.Helper()
	for _, factory := range persistentCloudStoreFactories(t) {
		factory := factory
		t.Run(name+"/"+factory.name, func(t *testing.T) {
			store := factory.create(t)
			if factory.teardown != nil {
				defer factory.teardown(t, store)
			}
			run(t, store)
		})
	}
}

func persistentCloudStoreFactories(t *testing.T) []cloudStoreFactory {
	t.Helper()
	cloudURI := strings.TrimSpace(firstNonEmpty(
		os.Getenv("LCP_CROSS_GO_CLOUD_STORAGE_URI"),
		os.Getenv("LCP_STORAGE_GCS_URI"),
		"gs://aiptesting.firebasestorage.app/lcp",
	))
	projectID := strings.TrimSpace(firstNonEmpty(os.Getenv("GOOGLE_CLOUD_PROJECT"), "aiptesting"))
	credentialsFile := cloudContractCredentialsFile(t)

	if _, err := os.Stat(credentialsFile); err != nil {
		t.Fatalf("cloud credentials file not found: %s", credentialsFile)
	}

	return []cloudStoreFactory{
		{
			name: "memory",
			create: func(t *testing.T) PersistentCacheStore[map[string]any] {
				t.Helper()
				return NewInMemoryPersistentStore[map[string]any]()
			},
		},
		{
			name: "cloud-storage",
			create: func(t *testing.T) PersistentCacheStore[map[string]any] {
				t.Helper()
				store, err := NewCloudStoragePersistentStoreFromURI[map[string]any](
					uniqueCloudURIForTest(cloudURI, t.Name()),
					CloudStoragePersistentStoreOptions{
						CredentialsFile: credentialsFile,
						ProjectID:       projectID,
					},
				)
				if err != nil {
					t.Fatalf("create cloud storage store: %v", err)
				}
				return store
			},
			teardown: func(t *testing.T, store PersistentCacheStore[map[string]any]) {
				t.Helper()
				if err := store.Clear(); err != nil {
					t.Fatalf("clear cloud storage store: %v", err)
				}
			},
		},
	}
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func uniqueCloudURIForTest(baseURI, testName string) string {
	re := regexp.MustCompile(`[^a-zA-Z0-9_-]+`)
	safeName := strings.Trim(re.ReplaceAllString(testName, "-"), "-")
	if safeName == "" {
		safeName = "case"
	}
	return fmt.Sprintf("%s/go-js-cloud/%s-%d", strings.TrimRight(baseURI, "/"), safeName, time.Now().UnixNano())
}

func cloudContractCredentialsFile(t *testing.T) string {
	t.Helper()
	credentialsFile := strings.TrimSpace(firstNonEmpty(
		os.Getenv("GCP_SA_KEY"),
		os.Getenv("GOOGLE_APPLICATION_CREDENTIALS"),
		"config/testing/aiptesting-firebase-adminsdk-fbsvc-398b4932fd.json",
	))

	if filepath.IsAbs(credentialsFile) {
		return credentialsFile
	}
	if _, err := os.Stat(credentialsFile); err == nil {
		return credentialsFile
	}
	fallback := filepath.Join("/Users/brian/dev/aco/aip/sdp/lcp/sdks/go", credentialsFile)
	if _, err := os.Stat(fallback); err == nil {
		return fallback
	}
	return credentialsFile
}
