package lcp

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"cloud.google.com/go/storage"
	"google.golang.org/api/iterator"
)

func (s *CloudStoragePersistentStore[T]) bucketHandle() *storage.BucketHandle {
	b := s.client.Bucket(s.bucket)
	if s.enableUserProject && s.projectID != "" {
		return b.UserProject(s.projectID)
	}
	return b
}

func (s *CloudStoragePersistentStore[T]) object(cacheKey string) *storage.ObjectHandle {
	return s.bucketHandle().Object(s.objectName(cacheKey))
}

func (s *CloudStoragePersistentStore[T]) objectName(cacheKey string) string {
	return s.prefix + strings.TrimSpace(cacheKey)
}

func (s *CloudStoragePersistentStore[T]) listObjectNames() ([]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), s.requestTimeout)
	defer cancel()

	it := s.bucketHandle().Objects(ctx, &storage.Query{Prefix: s.prefix})
	names := []string{}
	for {
		attrs, err := it.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("cloud storage list objects: %w", err)
		}
		if strings.HasSuffix(attrs.Name, "/") {
			continue
		}
		names = append(names, attrs.Name)
	}
	sort.Strings(names)
	return names, nil
}

func (s *CloudStoragePersistentStore[T]) readAllEntries() ([]CacheEntry[T], error) {
	names, err := s.listObjectNames()
	if err != nil {
		return nil, err
	}
	entries := make([]CacheEntry[T], 0, len(names))
	for _, name := range names {
		cacheKey := strings.TrimPrefix(name, s.prefix)
		normalizedKey, err := validateH57CacheKey(cacheKey, "cloud-storage.objectName")
		if err != nil {
			return nil, fmt.Errorf("cloud storage invalid object filename %s: %w", name, err)
		}
		raw, readErr := s.readObjectPayload(
			s.bucketHandle().Object(name),
			fmt.Sprintf("cloud storage read %s", name),
			fmt.Sprintf("cloud storage read payload %s", name),
			fmt.Sprintf("cloud storage close %s", name),
		)
		if readErr != nil {
			if isCloudObjectNotFound(readErr) {
				continue
			}
			return nil, readErr
		}
		entry, decodeErr := decodeCloudStorageEntry[T](raw, normalizedKey)
		if decodeErr != nil {
			return nil, fmt.Errorf("cloud storage decode payload %s: %w", name, decodeErr)
		}
		entries = append(entries, *entry)
	}
	return entries, nil
}

func (s *CloudStoragePersistentStore[T]) HydrateAllValid(now int64, limit *int) ([]CacheEntry[T], error) {
	entries, err := s.readAllEntries()
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].CacheKey < entries[j].CacheKey })
	out := make([]CacheEntry[T], 0, len(entries))
	for _, entry := range entries {
		eval := EvaluateTTL(entry.Metadata.CreatedAt, now, entry.Metadata.TTLMS)
		if eval.Status == TtlStatusExpired {
			continue
		}
		out = append(out, entry)
		if limit != nil && len(out) >= *limit {
			break
		}
	}
	return out, nil
}
