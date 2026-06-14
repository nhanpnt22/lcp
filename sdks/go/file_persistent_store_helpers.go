package lcp

import (
	"encoding/json"
	"os"
	"path/filepath"
)

func (s *FilePersistentStore[T]) filePath(cacheKey string) string {
	return filepath.Join(s.rootDir, cacheKey+".json")
}

func (s *FilePersistentStore[T]) readEntryFile(filePath string) (CacheEntry[T], bool) {
	var zero CacheEntry[T]
	bytes, err := os.ReadFile(filePath)
	if err != nil {
		return zero, false
	}
	var entry CacheEntry[T]
	if err := json.Unmarshal(bytes, &entry); err != nil {
		return zero, false
	}
	return entry, true
}
