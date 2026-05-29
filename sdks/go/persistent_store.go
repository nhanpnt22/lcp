package lcp

import "sync"

type PersistentCacheStore[T any] interface {
	Get(cacheKey string) (*CacheEntry[T], error)
	Set(entry CacheEntry[T]) error
	Delete(cacheKey string) error
	Clear() error
	PruneExpired(now int64) (int, error)
	HydrateAllValid(now int64, limit *int) ([]CacheEntry[T], error)
}

// InMemoryPersistentStore is a deterministic test/development implementation.
type InMemoryPersistentStore[T any] struct {
	mu      sync.RWMutex
	entries map[string]CacheEntry[T]
}

func NewInMemoryPersistentStore[T any]() *InMemoryPersistentStore[T] {
	return &InMemoryPersistentStore[T]{entries: map[string]CacheEntry[T]{}}
}

func (s *InMemoryPersistentStore[T]) Get(cacheKey string) (*CacheEntry[T], error) {
	normalizedKey, err := validateH57CacheKey(cacheKey, "persistent-memory.get")
	if err != nil {
		return nil, err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.entries[normalizedKey]
	if !ok {
		return nil, nil
	}
	copy := entry
	return &copy, nil
}

func (s *InMemoryPersistentStore[T]) Set(entry CacheEntry[T]) error {
	normalizedKey, err := validateH57CacheKey(entry.CacheKey, "persistent-memory.set")
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	entry.CacheKey = normalizedKey
	s.entries[normalizedKey] = entry
	return nil
}

func (s *InMemoryPersistentStore[T]) Delete(cacheKey string) error {
	normalizedKey, err := validateH57CacheKey(cacheKey, "persistent-memory.delete")
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.entries, normalizedKey)
	return nil
}

func (s *InMemoryPersistentStore[T]) Clear() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = map[string]CacheEntry[T]{}
	return nil
}

func (s *InMemoryPersistentStore[T]) PruneExpired(now int64) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	removed := 0
	for key, entry := range s.entries {
		eval := EvaluateTTL(entry.Metadata.CreatedAt, now, entry.Metadata.TTLMS)
		if eval.Status == TtlStatusExpired {
			delete(s.entries, key)
			removed++
		}
	}
	return removed, nil
}

func (s *InMemoryPersistentStore[T]) HydrateAllValid(now int64, limit *int) ([]CacheEntry[T], error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make([]CacheEntry[T], 0, len(s.entries))
	for _, entry := range s.entries {
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
