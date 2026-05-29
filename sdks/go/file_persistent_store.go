package lcp

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
)

const errReadCacheRootDir = "read cache root dir: %w"

// FilePersistentStore persists cache entries as JSON files under RootDir.
// This works for local disks and Cloud Storage FUSE mount paths.
type FilePersistentStore[T any] struct {
	mu      sync.RWMutex
	rootDir string
}

func NewFilePersistentStore[T any](rootDir string) (*FilePersistentStore[T], error) {
	if strings.TrimSpace(rootDir) == "" {
		return nil, errors.New("file persistent store rootDir is required")
	}
	return &FilePersistentStore[T]{rootDir: rootDir}, nil
}

func (s *FilePersistentStore[T]) Get(cacheKey string) (*CacheEntry[T], error) {
	normalizedKey, err := validateH57CacheKey(cacheKey, "file-persistent.get")
	if err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	filePath := s.filePath(normalizedKey)
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil, nil
		}
		return nil, fmt.Errorf("read cache file: %w", err)
	}
	var entry CacheEntry[T]
	if err := json.Unmarshal(bytes, &entry); err != nil {
		return nil, fmt.Errorf("unmarshal cache file: %w", err)
	}
	if entry.CacheKey != normalizedKey {
		return nil, nil
	}
	return &entry, nil
}

func (s *FilePersistentStore[T]) Set(entry CacheEntry[T]) error {
	normalizedKey, err := validateH57CacheKey(entry.CacheKey, "file-persistent.set")
	if err != nil {
		return err
	}
	entry.CacheKey = normalizedKey
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(s.rootDir, 0o755); err != nil {
		return fmt.Errorf("ensure cache root dir: %w", err)
	}
	bytes, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("marshal cache entry: %w", err)
	}
	filePath := s.filePath(normalizedKey)
	tmpPath := filePath + ".tmp"
	if err := os.WriteFile(tmpPath, bytes, 0o644); err != nil {
		return fmt.Errorf("write temp cache file: %w", err)
	}
	if err := os.Rename(tmpPath, filePath); err != nil {
		_ = os.Remove(tmpPath)
		return fmt.Errorf("commit cache file: %w", err)
	}
	return nil
}

func (s *FilePersistentStore[T]) Delete(cacheKey string) error {
	normalizedKey, err := validateH57CacheKey(cacheKey, "file-persistent.delete")
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	err = os.Remove(s.filePath(normalizedKey))
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("delete cache file: %w", err)
	}
	return nil
}

func (s *FilePersistentStore[T]) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, err := os.ReadDir(s.rootDir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return fmt.Errorf(errReadCacheRootDir, err)
	}
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		if err := os.Remove(filepath.Join(s.rootDir, entry.Name())); err != nil && !errors.Is(err, fs.ErrNotExist) {
			return fmt.Errorf("remove cache file: %w", err)
		}
	}
	return nil
}

func (s *FilePersistentStore[T]) PruneExpired(now int64) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	entries, err := os.ReadDir(s.rootDir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return 0, nil
		}
		return 0, fmt.Errorf(errReadCacheRootDir, err)
	}
	removed := 0
	for _, d := range entries {
		if d.IsDir() || !strings.HasSuffix(d.Name(), ".json") {
			continue
		}
		filePath := filepath.Join(s.rootDir, d.Name())
		entry, ok := s.readEntryFile(filePath)
		if !ok {
			continue
		}
		eval := EvaluateTTL(entry.Metadata.CreatedAt, now, entry.Metadata.TTLMS)
		if eval.Status != TtlStatusExpired {
			continue
		}
		if err := os.Remove(filePath); err == nil || errors.Is(err, fs.ErrNotExist) {
			removed++
		}
	}
	return removed, nil
}

func (s *FilePersistentStore[T]) HydrateAllValid(now int64, limit *int) ([]CacheEntry[T], error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, err := os.ReadDir(s.rootDir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return []CacheEntry[T]{}, nil
		}
		return nil, fmt.Errorf(errReadCacheRootDir, err)
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].Name() < entries[j].Name() })
	out := make([]CacheEntry[T], 0, len(entries))
	for _, d := range entries {
		if d.IsDir() || !strings.HasSuffix(d.Name(), ".json") {
			continue
		}
		filePath := filepath.Join(s.rootDir, d.Name())
		entry, ok := s.readEntryFile(filePath)
		if !ok {
			continue
		}
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
