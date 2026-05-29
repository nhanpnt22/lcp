package lcp

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"cloud.google.com/go/storage"
)

func (s *CloudStoragePersistentStore[T]) readObjectPayload(
	obj *storage.ObjectHandle,
	readErrMessage string,
	payloadErrMessage string,
	closeErrMessage string,
) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), s.requestTimeout)
	r, err := obj.NewReader(ctx)
	if err != nil {
		cancel()
		return nil, fmt.Errorf(cloudStorageWrapFormat, readErrMessage, err)
	}
	raw, readErr := io.ReadAll(r)
	closeErr := r.Close()
	cancel()
	if closeErr != nil {
		return nil, fmt.Errorf(cloudStorageWrapFormat, closeErrMessage, closeErr)
	}
	if readErr != nil {
		return nil, fmt.Errorf(cloudStorageWrapFormat, payloadErrMessage, readErr)
	}
	return raw, nil
}

func decodeCloudStorageEntry[T any](raw []byte, expectedCacheKey string) (*CacheEntry[T], error) {
	var entry CacheEntry[T]
	if err := json.Unmarshal(raw, &entry); err == nil {
		if entry.CacheKey == "" {
			entry.CacheKey = expectedCacheKey
		}
		if entry.CacheKey == expectedCacheKey && (entry.Metadata.CreatedAt != 0 || entry.Metadata.SchemaVersion != "" || entry.Metadata.TTLMS != 0) {
			return &entry, nil
		}
	}

	// Backward compatibility: old payloads persisted only `data` without entry metadata.
	var data T
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, err
	}
	legacy := &CacheEntry[T]{
		CacheKey: expectedCacheKey,
		Data:     data,
		Metadata: CreateCacheMetadata(CacheSourceAPI, time.Now().UnixMilli(), 0, "v1", "v1", "", "", false),
	}
	return legacy, nil
}

func parseGCSURI(uri string) (bucket, prefix string, err error) {
	trimmed := strings.TrimSpace(uri)
	if !strings.HasPrefix(trimmed, "gs://") {
		return "", "", fmt.Errorf("cloud storage URI must start with gs://")
	}
	withoutScheme := strings.TrimPrefix(trimmed, "gs://")
	if withoutScheme == "" || strings.HasPrefix(withoutScheme, "/") {
		return "", "", fmt.Errorf("cloud storage URI bucket is required")
	}
	parts := strings.SplitN(withoutScheme, "/", 2)
	bucket = strings.TrimSpace(parts[0])
	if bucket == "" {
		return "", "", fmt.Errorf("cloud storage URI bucket is required")
	}
	if len(parts) == 1 {
		return bucket, "", nil
	}
	prefix = strings.TrimSpace(parts[1])
	prefix = strings.TrimPrefix(prefix, "/")
	return bucket, prefix, nil
}

func isCloudObjectNotFound(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, storage.ErrObjectNotExist) {
		return true
	}
	message := strings.ToLower(err.Error())
	return strings.Contains(message, "object doesn't exist") || strings.Contains(message, "notfound") || strings.Contains(message, "no such object")
}
