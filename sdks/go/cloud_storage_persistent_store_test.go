package lcp

import "testing"

func TestParseGCSURIBucketOnly(t *testing.T) {
	bucket, prefix, err := parseGCSURI("gs://aiptesting.firebasestorage.app")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if bucket != "aiptesting.firebasestorage.app" {
		t.Fatalf("expected bucket aiptesting.firebasestorage.app, got %q", bucket)
	}
	if prefix != "" {
		t.Fatalf("expected empty prefix, got %q", prefix)
	}
}

func TestParseGCSURIWithPrefix(t *testing.T) {
	bucket, prefix, err := parseGCSURI("gs://aiptesting.firebasestorage.app/lcp")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if bucket != "aiptesting.firebasestorage.app" {
		t.Fatalf("expected bucket aiptesting.firebasestorage.app, got %q", bucket)
	}
	if prefix != "lcp" {
		t.Fatalf("expected prefix lcp, got %q", prefix)
	}
}

func TestParseGCSURIWithNestedPrefix(t *testing.T) {
	bucket, prefix, err := parseGCSURI("gs://aiptesting.firebasestorage.app/lcp/cache")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if bucket != "aiptesting.firebasestorage.app" {
		t.Fatalf("expected bucket aiptesting.firebasestorage.app, got %q", bucket)
	}
	if prefix != "lcp/cache" {
		t.Fatalf("expected prefix lcp/cache, got %q", prefix)
	}
}

func TestParseGCSURIRejectsMissingScheme(t *testing.T) {
	_, _, err := parseGCSURI("aiptesting.firebasestorage.app/lcp")
	if err == nil {
		t.Fatalf("expected error for missing gs:// scheme")
	}
}

func TestParseGCSURIRejectsMissingBucket(t *testing.T) {
	_, _, err := parseGCSURI("gs:///lcp")
	if err == nil {
		t.Fatalf("expected error for missing bucket")
	}
}

func TestNewCloudStoragePersistentStoreRejectsUserProjectWithoutProjectID(t *testing.T) {
	_, err := NewCloudStoragePersistentStore[map[string]any](
		"aiptesting.firebasestorage.app",
		"lcp",
		CloudStoragePersistentStoreOptions{EnableUserProject: true},
	)
	if err == nil {
		t.Fatalf("expected error when EnableUserProject=true and ProjectID is empty")
	}
}

func TestCloudStoragePersistentStoreCloseNilReceiver(t *testing.T) {
	var store *CloudStoragePersistentStore[map[string]any]
	if err := store.Close(); err != nil {
		t.Fatalf("expected nil error for nil receiver close, got %v", err)
	}
}
