package lcp

import "sync"

type MemoryCacheStore[T any] struct {
	mu         sync.RWMutex
	entries    map[string]CacheEntry[T]
	order      []string
	maxEntries int
	now        func() int64
}

func mustValidH57CacheKey(cacheKey string, operation string) string {
	normalizedKey, err := validateH57CacheKey(cacheKey, operation)
	if err != nil {
		panic(err)
	}
	return normalizedKey
}

func NewMemoryCacheStore[T any](maxEntries int, now func() int64) *MemoryCacheStore[T] {
	if maxEntries <= 0 {
		maxEntries = 128
	}
	if now == nil {
		now = nowMS
	}
	return &MemoryCacheStore[T]{
		entries:    map[string]CacheEntry[T]{},
		maxEntries: maxEntries,
		now:        now,
	}
}

func (s *MemoryCacheStore[T]) Get(cacheKey string) *CacheEntry[T] {
	normalizedKey := mustValidH57CacheKey(cacheKey, "memory.get")
	s.mu.Lock()
	defer s.mu.Unlock()
	entry, ok := s.entries[normalizedKey]
	if !ok {
		return nil
	}
	eval := EvaluateTTL(entry.Metadata.CreatedAt, s.now(), entry.Metadata.TTLMS)
	if eval.Status == TtlStatusExpired {
		delete(s.entries, normalizedKey)
		s.deleteFromOrder(normalizedKey)
		return nil
	}
	copy := entry
	return &copy
}

func (s *MemoryCacheStore[T]) Peek(cacheKey string) *CacheEntry[T] {
	normalizedKey := mustValidH57CacheKey(cacheKey, "memory.peek")
	s.mu.RLock()
	defer s.mu.RUnlock()
	entry, ok := s.entries[normalizedKey]
	if !ok {
		return nil
	}
	copy := entry
	return &copy
}

func (s *MemoryCacheStore[T]) Set(entry CacheEntry[T]) {
	normalizedKey := mustValidH57CacheKey(entry.CacheKey, "memory.set")
	s.mu.Lock()
	defer s.mu.Unlock()
	entry.CacheKey = normalizedKey
	if _, exists := s.entries[normalizedKey]; !exists {
		s.order = append(s.order, normalizedKey)
	}
	s.entries[normalizedKey] = entry
	s.evictIfNeeded()
}

func (s *MemoryCacheStore[T]) Delete(cacheKey string) {
	normalizedKey := mustValidH57CacheKey(cacheKey, "memory.delete")
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.entries, normalizedKey)
	s.deleteFromOrder(normalizedKey)
}

func (s *MemoryCacheStore[T]) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.entries = map[string]CacheEntry[T]{}
	s.order = nil
}

func (s *MemoryCacheStore[T]) deleteFromOrder(cacheKey string) {
	for i, key := range s.order {
		if key == cacheKey {
			s.order = append(s.order[:i], s.order[i+1:]...)
			return
		}
	}
}

func (s *MemoryCacheStore[T]) evictIfNeeded() {
	for len(s.entries) > s.maxEntries && len(s.order) > 0 {
		oldest := s.order[0]
		s.order = s.order[1:]
		delete(s.entries, oldest)
	}
}
