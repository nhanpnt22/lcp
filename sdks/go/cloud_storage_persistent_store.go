package lcp

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"cloud.google.com/go/storage"
	"google.golang.org/api/option"
)

type CloudStoragePersistentStoreOptions struct {
	CredentialsFile   string
	ProjectID         string
	EnableUserProject bool
	RequestTimeout    time.Duration
}

type CloudStoragePersistentStore[T any] struct {
	client            *storage.Client
	bucket            string
	prefix            string
	projectID         string
	enableUserProject bool
	requestTimeout    time.Duration
}

const cloudStorageWrapFormat = "%s: %w"

func NewCloudStoragePersistentStoreFromURI[T any](uri string, options CloudStoragePersistentStoreOptions) (*CloudStoragePersistentStore[T], error) {
	bucket, prefix, err := parseGCSURI(uri)
	if err != nil {
		return nil, err
	}
	return NewCloudStoragePersistentStore[T](bucket, prefix, options)
}

func NewCloudStoragePersistentStore[T any](bucket, prefix string, options CloudStoragePersistentStoreOptions) (*CloudStoragePersistentStore[T], error) {
	trimmedBucket := strings.TrimSpace(bucket)
	if trimmedBucket == "" {
		return nil, fmt.Errorf("cloud storage bucket is required")
	}

	trimmedProjectID := strings.TrimSpace(options.ProjectID)
	if options.EnableUserProject && trimmedProjectID == "" {
		return nil, fmt.Errorf("cloud storage projectID is required when enableUserProject=true")
	}

	cleanPrefix := strings.TrimSpace(prefix)
	cleanPrefix = strings.TrimPrefix(cleanPrefix, "/")
	if cleanPrefix != "" && !strings.HasSuffix(cleanPrefix, "/") {
		cleanPrefix += "/"
	}

	clientOptions := []option.ClientOption{}
	if strings.TrimSpace(options.CredentialsFile) != "" {
		clientOptions = append(clientOptions, option.WithCredentialsFile(strings.TrimSpace(options.CredentialsFile)))
	}
	client, err := storage.NewGRPCClient(context.Background(), clientOptions...)
	if err != nil && strings.Contains(err.Error(), "WithHTTPClient is incompatible with QuotaProject") {
		if value, ok := os.LookupEnv("GOOGLE_CLOUD_QUOTA_PROJECT"); ok {
			_ = os.Unsetenv("GOOGLE_CLOUD_QUOTA_PROJECT")
			client, err = storage.NewGRPCClient(context.Background(), clientOptions...)
			_ = os.Setenv("GOOGLE_CLOUD_QUOTA_PROJECT", value)
		}
	}
	if err != nil {
		// Fallback to HTTP transport when gRPC is unavailable in the runtime.
		client, err = storage.NewClient(context.Background(), clientOptions...)
	}
	if err != nil {
		return nil, fmt.Errorf("create cloud storage client: %w", err)
	}

	requestTimeout := options.RequestTimeout
	if requestTimeout <= 0 {
		requestTimeout = 30 * time.Second
	}

	return &CloudStoragePersistentStore[T]{
		client:            client,
		bucket:            trimmedBucket,
		prefix:            cleanPrefix,
		projectID:         trimmedProjectID,
		enableUserProject: options.EnableUserProject,
		requestTimeout:    requestTimeout,
	}, nil
}

func (s *CloudStoragePersistentStore[T]) Close() error {
	if s == nil || s.client == nil {
		return nil
	}
	return s.client.Close()
}

func (s *CloudStoragePersistentStore[T]) Get(cacheKey string) (*CacheEntry[T], error) {
	normalizedKey, err := validateH57CacheKey(cacheKey, "cloud-storage.get")
	if err != nil {
		return nil, err
	}
	raw, err := s.readObjectPayload(s.object(normalizedKey), "cloud storage read object", "cloud storage read payload", "cloud storage close object")
	if err != nil {
		if isCloudObjectNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	entry, err := decodeCloudStorageEntry[T](raw, normalizedKey)
	if err != nil {
		return nil, fmt.Errorf("cloud storage decode value: %w", err)
	}
	return entry, nil
}

func (s *CloudStoragePersistentStore[T]) Set(entry CacheEntry[T]) error {
	normalizedKey, err := validateH57CacheKey(entry.CacheKey, "cloud-storage.set")
	if err != nil {
		return err
	}
	entry.CacheKey = normalizedKey
	ctx, cancel := context.WithTimeout(context.Background(), s.requestTimeout)
	defer cancel()

	w := s.object(normalizedKey).NewWriter(ctx)
	w.ContentType = "application/json"
	if err := json.NewEncoder(w).Encode(entry); err != nil {
		_ = w.Close()
		return fmt.Errorf("cloud storage encode value: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("cloud storage write value: %w", err)
	}
	return nil
}

func (s *CloudStoragePersistentStore[T]) Delete(cacheKey string) error {
	normalizedKey, err := validateH57CacheKey(cacheKey, "cloud-storage.delete")
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), s.requestTimeout)
	defer cancel()

	err = s.object(normalizedKey).Delete(ctx)
	if err != nil && !isCloudObjectNotFound(err) {
		return fmt.Errorf("cloud storage delete entry: %w", err)
	}
	return nil
}

func (s *CloudStoragePersistentStore[T]) Clear() error {
	objectNames, err := s.listObjectNames()
	if err != nil {
		return err
	}
	for _, name := range objectNames {
		ctx, cancel := context.WithTimeout(context.Background(), s.requestTimeout)
		err := s.bucketHandle().Object(name).Delete(ctx)
		cancel()
		if err != nil && !isCloudObjectNotFound(err) {
			return fmt.Errorf("cloud storage clear entry %s: %w", name, err)
		}
	}
	return nil
}

func (s *CloudStoragePersistentStore[T]) PruneExpired(now int64) (int, error) {
	entries, err := s.readAllEntries()
	if err != nil {
		return 0, err
	}
	removed := 0
	for _, entry := range entries {
		eval := EvaluateTTL(entry.Metadata.CreatedAt, now, entry.Metadata.TTLMS)
		if eval.Status != TtlStatusExpired {
			continue
		}
		if err := s.Delete(entry.CacheKey); err != nil {
			return removed, err
		}
		removed++
	}
	return removed, nil
}
