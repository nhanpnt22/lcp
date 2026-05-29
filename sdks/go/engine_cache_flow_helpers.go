package lcp

import (
	"context"
	"errors"
	"fmt"
)

func (e *ReadThroughCacheEngine[T]) tryServeStale(cacheKey string, request CacheRequest[T]) (CacheExecutionResult[T], bool) {
	staleEntry := e.expiredPeek(cacheKey)
	if staleEntry == nil || !request.AllowStaleOnExpired || e.shouldBypassStateAlignment(request, staleEntry.Data) {
		return CacheExecutionResult[T]{}, false
	}
	e.emitBackgroundRefreshSignal(request, cacheKey)
	e.trackResumeState(CacheSourceCache, staleEntry.Data, cacheKey, request)
	return CacheExecutionResult[T]{
		CacheKey: cacheKey,
		Source:   CacheSourceCache,
		Data:     staleEntry.Data,
		Stale:    true,
	}, true
}

func (e *ReadThroughCacheEngine[T]) tryServeMemory(cacheKey string, request CacheRequest[T]) (CacheExecutionResult[T], bool) {
	memoryHit := e.memoryStore.Get(cacheKey)
	if memoryHit == nil || e.shouldBypassStateAlignment(request, memoryHit.Data) {
		return CacheExecutionResult[T]{}, false
	}
	e.trackResumeState(CacheSourceCache, memoryHit.Data, cacheKey, request)
	return CacheExecutionResult[T]{
		CacheKey: cacheKey,
		Source:   CacheSourceCache,
		Data:     memoryHit.Data,
		Stale:    false,
	}, true
}

func (e *ReadThroughCacheEngine[T]) tryServePersistent(cacheKey string, request CacheRequest[T]) (CacheExecutionResult[T], bool) {
	if e.persistentStore == nil {
		return CacheExecutionResult[T]{}, false
	}

	persisted, err := e.persistentStore.Get(cacheKey)
	if err != nil {
		e.reportInternalError(fmt.Errorf("read persistent entry: %w", err))
		return CacheExecutionResult[T]{}, false
	}
	if persisted == nil {
		return CacheExecutionResult[T]{}, false
	}
	if !e.isValidEntry(*persisted, cacheKey) {
		if delErr := e.persistentStore.Delete(cacheKey); delErr != nil {
			e.reportInternalError(fmt.Errorf("delete invalid persistent entry: %w", delErr))
		}
		return CacheExecutionResult[T]{}, false
	}
	if e.shouldBypassStateAlignment(request, persisted.Data) {
		return CacheExecutionResult[T]{}, false
	}

	e.memoryStore.Set(*persisted)
	e.trackResumeState(CacheSourceCache, persisted.Data, cacheKey, request)
	return CacheExecutionResult[T]{
		CacheKey: cacheKey,
		Source:   CacheSourceCache,
		Data:     persisted.Data,
		Stale:    false,
	}, true
}

func (e *ReadThroughCacheEngine[T]) isValidEntry(entry CacheEntry[T], cacheKey string) bool {
	err := AssertCacheEntryInvariants(entry, ValidationOptions{
		Parity: CacheMetadataParityExpectation{
			SchemaVersion:  e.parity.SchemaVersion,
			SpecChecksum:   e.parity.SpecChecksum,
			CacheNamespace: e.parity.CacheNamespace,
		},
		ExpectedCacheKey: cacheKey,
	})
	return err == nil
}

func (e *ReadThroughCacheEngine[T]) expiredPeek(cacheKey string) *CacheEntry[T] {
	entry := e.memoryStore.Peek(cacheKey)
	if entry == nil {
		return nil
	}
	eval := EvaluateTTL(entry.Metadata.CreatedAt, e.now(), entry.Metadata.TTLMS)
	if eval.Status == TtlStatusExpired {
		return entry
	}
	return nil
}

func (e *ReadThroughCacheEngine[T]) fetchAndPopulate(ctx context.Context, cacheKey string, request CacheRequest[T]) (CacheExecutionResult[T], error) {
	var zero CacheExecutionResult[T]
	if request.FetchFromAPI == nil {
		return zero, errors.New("fetchFromAPI is required")
	}
	apiResult, err := request.FetchFromAPI(ctx)
	if err != nil {
		return zero, err
	}

	ttlMS := apiResult.TTLMS
	if ttlMS == nil && apiResult.Headers != nil {
		ttlMS = ExtractOACTTLMS(apiResult.Headers)
	}
	if ttlMS == nil {
		e.trackResumeState(CacheSourceAPI, apiResult.Data, cacheKey, request)
		return CacheExecutionResult[T]{CacheKey: cacheKey, Source: CacheSourceAPI, Data: apiResult.Data, Stale: false}, nil
	}

	entry := CacheEntry[T]{
		CacheKey: cacheKey,
		Data:     apiResult.Data,
		Metadata: CreateCacheMetadata(
			CacheSourceAPI,
			e.now(),
			*ttlMS,
			e.parity.SchemaVersion,
			e.parity.DataVersion,
			e.parity.SpecChecksum,
			e.parity.CacheNamespace,
			false,
		),
	}
	if err := AssertCacheEntryInvariants(entry, ValidationOptions{
		Parity: CacheMetadataParityExpectation{
			SchemaVersion:  e.parity.SchemaVersion,
			SpecChecksum:   e.parity.SpecChecksum,
			CacheNamespace: e.parity.CacheNamespace,
		},
		ExpectedCacheKey: cacheKey,
	}); err != nil {
		return zero, err
	}

	e.safeMemorySet(entry)
	if e.shouldPersistToPersistentStore(entry) {
		e.safePersistentSet(entry)
	}
	e.trackResumeState(CacheSourceAPI, apiResult.Data, cacheKey, request)
	return CacheExecutionResult[T]{CacheKey: cacheKey, Source: CacheSourceAPI, Data: apiResult.Data, Stale: false}, nil
}
