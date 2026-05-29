package lcp

import (
	"context"
	"os"
	"strings"
	"testing"

	"cloud.google.com/go/storage"
	"google.golang.org/api/option"
)

type cloudContractEdgeFixture struct {
	store  *CloudStoragePersistentStore[map[string]any]
	client *storage.Client
	bucket string
	prefix string
}

func newCloudContractEdgeFixture(t *testing.T) *cloudContractEdgeFixture {
	t.Helper()
	cloudURI := uniqueCloudURIForTest(strings.TrimSpace(firstNonEmpty(
		os.Getenv("LCP_CROSS_GO_CLOUD_STORAGE_URI"),
		os.Getenv("LCP_STORAGE_GCS_URI"),
		"gs://aiptesting.firebasestorage.app/lcp",
	)), t.Name())
	credentialsFile := cloudContractCredentialsFile(t)

	store, err := NewCloudStoragePersistentStoreFromURI[map[string]any](cloudURI, CloudStoragePersistentStoreOptions{CredentialsFile: credentialsFile})
	if err != nil {
		t.Fatalf("create cloud storage store: %v", err)
	}

	client, err := storage.NewClient(context.Background(), option.WithCredentialsFile(credentialsFile))
	if err != nil {
		t.Fatalf("create storage client: %v", err)
	}

	bucket, prefix, err := parseGCSURI(cloudURI)
	if err != nil {
		t.Fatalf("parse cloud uri: %v", err)
	}

	return &cloudContractEdgeFixture{
		store:  store,
		client: client,
		bucket: bucket,
		prefix: prefix,
	}
}

func (f *cloudContractEdgeFixture) cleanup(t *testing.T) {
	t.Helper()
	if f.store != nil {
		if err := f.store.Clear(); err != nil {
			t.Fatalf("clear cloud storage store: %v", err)
		}
	}
	if f.client != nil {
		_ = f.client.Close()
	}
}

func (f *cloudContractEdgeFixture) objectName(name string) string {
	if f.prefix == "" {
		return name
	}
	return f.prefix + "/" + name
}

func TestPersistentStoreCloudContractRejectsNonH57ObjectFilename(t *testing.T) {
	fixture := newCloudContractEdgeFixture(t)
	defer fixture.cleanup(t)

	badObjectName := fixture.objectName("not-h57-filename")
	if err := fixture.client.Bucket(fixture.bucket).Object(badObjectName).NewWriter(context.Background()).Close(); err != nil {
		t.Fatalf("seed bad object filename: %v", err)
	}
	defer func() {
		_ = fixture.client.Bucket(fixture.bucket).Object(badObjectName).Delete(context.Background())
	}()

	key := mustH57CloudKey(t, "valid")
	mustCloudSet(t, fixture.store, cloudContractEntry(key, "new", 1000, 10000))

	if _, err := fixture.store.HydrateAllValid(5000, nil); err == nil || !strings.Contains(err.Error(), "canonical H57") {
		t.Fatalf("expected hydrate error for non-H57 filename, got %v", err)
	}
	if _, err := fixture.store.PruneExpired(5000); err == nil || !strings.Contains(err.Error(), "canonical H57") {
		t.Fatalf("expected prune error for non-H57 filename, got %v", err)
	}
}

func TestPersistentStoreCloudContractRejectsCorruptObjectPayload(t *testing.T) {
	fixture := newCloudContractEdgeFixture(t)
	defer fixture.cleanup(t)

	key := mustH57CloudKey(t, "corrupt-payload")
	objectName := fixture.objectName(key)

	w := fixture.client.Bucket(fixture.bucket).Object(objectName).NewWriter(context.Background())
	if _, err := w.Write([]byte("{not-json")); err != nil {
		t.Fatalf("write corrupt payload: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close corrupt payload writer: %v", err)
	}

	if _, err := fixture.store.HydrateAllValid(5000, nil); err == nil || !strings.Contains(err.Error(), "decode payload") {
		t.Fatalf("expected hydrate decode error for corrupt payload, got %v", err)
	}
	if _, err := fixture.store.PruneExpired(5000); err == nil || !strings.Contains(err.Error(), "decode payload") {
		t.Fatalf("expected prune decode error for corrupt payload, got %v", err)
	}
}
