package lcp

import (
	"context"
)

type CachePersistenceMode string

const (
	CachePersistenceAuto       CachePersistenceMode = "auto"
	CachePersistenceMemoryOnly CachePersistenceMode = "memory-only"
	CachePersistenceDual       CachePersistenceMode = "dual"
)

type CacheParity struct {
	SchemaVersion  string
	DataVersion    string
	SpecChecksum   string
	CacheNamespace string
}

type CachePersistenceConfig[T any] struct {
	Mode                           CachePersistenceMode
	ShortThresholdMS               int64
	ShouldPersistToPersistentStore func(CacheEntry[T]) bool
}

type ApiFetchResult[T any] struct {
	Data    T
	TTLMS   *int64
	Headers map[string]string
}

type CacheRequest[T any] struct {
	KeyInput            CacheKeyInput
	HashFn              HashFn
	FetchFromAPI        func(context.Context) (ApiFetchResult[T], error)
	AllowStaleOnExpired bool
	ResumeState         *ResumeState
	Trace               *CacheTraceContext
	OnBackgroundRefresh func(BackgroundRefreshSignal)
}

type BackgroundRefreshSignal struct {
	CacheKey  string
	RequestID string
}

type CacheExecutionResult[T any] struct {
	CacheKey string
	Source   CacheSource
	Data     T
	Stale    bool
}

type ResolveResumeStateParams[T any] struct {
	Source   CacheSource
	Data     T
	CacheKey string
	Request  CacheRequest[T]
}

type ResolveResumeState[T any] func(ResolveResumeStateParams[T]) *ResumeState

type ReadThroughCacheEngine[T any] struct {
	memoryStore        *MemoryCacheStore[T]
	persistentStore    PersistentCacheStore[T]
	singleFlight       *CacheSingleFlight[CacheExecutionResult[T]]
	parity             CacheParity
	persistence        CachePersistenceConfig[T]
	resumeStore        *InMemoryResumeStateStore
	resolveResumeState ResolveResumeState[T]
	onInternalError    func(error)
	now                func() int64
}

func NewReadThroughCacheEngine[T any](
	memoryStore *MemoryCacheStore[T],
	parity CacheParity,
	options ...func(*ReadThroughCacheEngine[T]),
) *ReadThroughCacheEngine[T] {
	engine := &ReadThroughCacheEngine[T]{
		memoryStore: memoryStore,
		parity:      parity,
		persistence: CachePersistenceConfig[T]{
			Mode:             CachePersistenceDual,
			ShortThresholdMS: 300000,
		},
		now: nowMS,
	}
	for _, opt := range options {
		opt(engine)
	}
	return engine
}

func WithPersistentStore[T any](store PersistentCacheStore[T]) func(*ReadThroughCacheEngine[T]) {
	return func(e *ReadThroughCacheEngine[T]) { e.persistentStore = store }
}

func WithSingleFlight[T any](sf *CacheSingleFlight[CacheExecutionResult[T]]) func(*ReadThroughCacheEngine[T]) {
	return func(e *ReadThroughCacheEngine[T]) { e.singleFlight = sf }
}

func WithPersistenceConfig[T any](config CachePersistenceConfig[T]) func(*ReadThroughCacheEngine[T]) {
	return func(e *ReadThroughCacheEngine[T]) { e.persistence = config }
}

func WithResumeStore[T any](store *InMemoryResumeStateStore) func(*ReadThroughCacheEngine[T]) {
	return func(e *ReadThroughCacheEngine[T]) { e.resumeStore = store }
}

func WithResolveResumeState[T any](resolver ResolveResumeState[T]) func(*ReadThroughCacheEngine[T]) {
	return func(e *ReadThroughCacheEngine[T]) { e.resolveResumeState = resolver }
}

func WithNowFn[T any](now func() int64) func(*ReadThroughCacheEngine[T]) {
	return func(e *ReadThroughCacheEngine[T]) {
		if now != nil {
			e.now = now
		}
	}
}

func WithInternalErrorHandler[T any](handler func(error)) func(*ReadThroughCacheEngine[T]) {
	return func(e *ReadThroughCacheEngine[T]) { e.onInternalError = handler }
}

func (e *ReadThroughCacheEngine[T]) GetWidgetStateMap() map[string]int64 {
	if e.resumeStore == nil {
		return map[string]int64{}
	}
	return e.resumeStore.Snapshot()
}

func (e *ReadThroughCacheEngine[T]) ClearWidgetStateMap() {
	if e.resumeStore != nil {
		e.resumeStore.Clear()
	}
}

func (e *ReadThroughCacheEngine[T]) UpdateWidgetState(state ResumeState) {
	if e.resumeStore != nil {
		e.resumeStore.Update(state)
	}
}

func (e *ReadThroughCacheEngine[T]) BuildResumeHintForTrace(traceID string, hashFn HashFn) (map[string]any, error) {
	return BuildResumeHint(traceID, e.GetWidgetStateMap(), hashFn)
}

func (e *ReadThroughCacheEngine[T]) Execute(ctx context.Context, request CacheRequest[T]) (CacheExecutionResult[T], error) {
	var zero CacheExecutionResult[T]
	cacheKey, err := ComputeCacheKey(request.KeyInput, request.HashFn)
	if err != nil {
		return zero, err
	}

	if result, ok := e.tryServeStale(cacheKey, request); ok {
		return result, nil
	}

	if result, ok := e.tryServeMemory(cacheKey, request); ok {
		return result, nil
	}

	if result, ok := e.tryServePersistent(cacheKey, request); ok {
		return result, nil
	}

	runFetch := func() (CacheExecutionResult[T], error) {
		return e.fetchAndPopulate(ctx, cacheKey, request)
	}
	if e.singleFlight != nil {
		return e.singleFlight.Run(cacheKey, runFetch)
	}
	return runFetch()
}
