package lcp

import "fmt"

func (e *ReadThroughCacheEngine[T]) shouldPersistToPersistentStore(entry CacheEntry[T]) bool {
	if e.persistentStore == nil {
		return false
	}
	if override := e.persistence.ShouldPersistToPersistentStore; override != nil {
		return override(entry)
	}
	switch e.persistence.Mode {
	case CachePersistenceMemoryOnly:
		return false
	case CachePersistenceDual:
		return true
	case CachePersistenceAuto:
		return entry.Metadata.TTLMS > e.persistence.ShortThresholdMS
	default:
		return true
	}
}

func (e *ReadThroughCacheEngine[T]) emitBackgroundRefreshSignal(request CacheRequest[T], cacheKey string) {
	if request.OnBackgroundRefresh == nil {
		return
	}
	requestID := ""
	if request.Trace != nil {
		requestID = request.Trace.RequestID
	}
	request.OnBackgroundRefresh(BackgroundRefreshSignal{CacheKey: cacheKey, RequestID: requestID})
}

func (e *ReadThroughCacheEngine[T]) safeMemorySet(entry CacheEntry[T]) {
	defer func() {
		if recovered := recover(); recovered != nil {
			e.reportInternalError(fmt.Errorf("memory store panic: %v", recovered))
		}
	}()
	e.memoryStore.Set(entry)
}

func (e *ReadThroughCacheEngine[T]) safePersistentSet(entry CacheEntry[T]) {
	if e.persistentStore == nil {
		return
	}
	if err := e.persistentStore.Set(entry); err != nil {
		e.reportInternalError(fmt.Errorf("write persistent entry: %w", err))
	}
}

func (e *ReadThroughCacheEngine[T]) reportInternalError(err error) {
	if err == nil || e.onInternalError == nil {
		return
	}
	e.onInternalError(err)
}
