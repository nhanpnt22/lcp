package lcp

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
)

func (s *FilePersistentStore[T]) filePath(cacheKey string) string {
	sum := sha256.Sum256([]byte(cacheKey))
	name := hex.EncodeToString(sum[:]) + ".json"
	return filepath.Join(s.rootDir, name)
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
