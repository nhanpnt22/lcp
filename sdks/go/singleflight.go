package lcp

import "sync"

type inflightCall[T any] struct {
	wg  sync.WaitGroup
	res T
	err error
}

type CacheSingleFlight[T any] struct {
	mu    sync.Mutex
	calls map[string]*inflightCall[T]
}

func NewCacheSingleFlight[T any]() *CacheSingleFlight[T] {
	return &CacheSingleFlight[T]{calls: map[string]*inflightCall[T]{}}
}

func (s *CacheSingleFlight[T]) Run(cacheKey string, fn func() (T, error)) (T, error) {
	s.mu.Lock()
	if existing, ok := s.calls[cacheKey]; ok {
		s.mu.Unlock()
		existing.wg.Wait()
		return existing.res, existing.err
	}
	call := &inflightCall[T]{}
	call.wg.Add(1)
	s.calls[cacheKey] = call
	s.mu.Unlock()

	call.res, call.err = fn()
	call.wg.Done()

	s.mu.Lock()
	delete(s.calls, cacheKey)
	s.mu.Unlock()

	return call.res, call.err
}
