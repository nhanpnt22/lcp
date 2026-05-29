package lcp

import (
	"context"
	"strings"
	"testing"
)

func TestEngineReturnsAPIThenCache(t *testing.T) {
	store := NewMemoryCacheStore[map[string]any](10, func() int64 { return 1000 })
	calls := 0
	engine := NewReadThroughCacheEngine(
		store,
		CacheParity{SchemaVersion: "v1", DataVersion: "v1", SpecChecksum: "spec", CacheNamespace: "ns"},
		WithNowFn[map[string]any](func() int64 { return 1000 }),
	)
	request := CacheRequest[map[string]any]{
		KeyInput: CacheKeyInput{Namespace: "profile", OperationID: "get", Payload: map[string]any{"userId": "u1"}, SchemaVersion: "v1", SpecChecksum: "spec", UserScope: "u1"},
		HashFn:   H57HashFn,
		FetchFromAPI: func(context.Context) (ApiFetchResult[map[string]any], error) {
			calls++
			ttl := int64(60000)
			return ApiFetchResult[map[string]any]{Data: map[string]any{"name": "alice"}, TTLMS: &ttl}, nil
		},
	}
	first, err := engine.Execute(context.Background(), request)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	second, err := engine.Execute(context.Background(), request)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if first.Source != CacheSourceAPI || second.Source != CacheSourceCache {
		t.Fatalf("expected API then CACHE, got %s then %s", first.Source, second.Source)
	}
	if calls != 1 {
		t.Fatalf("expected 1 API call, got %d", calls)
	}
}

func TestEngineBypassesWriteWhenTTLIsMissing(t *testing.T) {
	store := NewMemoryCacheStore[map[string]any](10, func() int64 { return 1000 })
	calls := 0
	engine := NewReadThroughCacheEngine(
		store,
		CacheParity{SchemaVersion: "v1", DataVersion: "v1", SpecChecksum: "spec", CacheNamespace: "ns"},
		WithNowFn[map[string]any](func() int64 { return 1000 }),
	)
	request := CacheRequest[map[string]any]{
		KeyInput: CacheKeyInput{Namespace: "profile", OperationID: "get", Payload: map[string]any{"userId": "u1"}, SchemaVersion: "v1", SpecChecksum: "spec", UserScope: "u1"},
		HashFn:   H57HashFn,
		FetchFromAPI: func(context.Context) (ApiFetchResult[map[string]any], error) {
			calls++
			return ApiFetchResult[map[string]any]{Data: map[string]any{"name": "alice"}}, nil
		},
	}
	first, _ := engine.Execute(context.Background(), request)
	second, _ := engine.Execute(context.Background(), request)
	if first.Source != CacheSourceAPI || second.Source != CacheSourceAPI {
		t.Fatalf("expected API on both calls")
	}
	if calls != 2 {
		t.Fatalf("expected 2 API calls, got %d", calls)
	}
}

func TestEngineBypassesStaleCacheWhenResumeStoreNewer(t *testing.T) {
	store := NewMemoryCacheStore[map[string]any](10, func() int64 { return 1000 })
	resume := NewInMemoryResumeStateStore()
	cacheKey, err := ComputeCacheKey(CacheKeyInput{
		Namespace:     "profile",
		OperationID:   "get",
		Payload:       map[string]any{"userId": "u1"},
		SchemaVersion: "v1",
		SpecChecksum:  "spec",
		UserScope:     "u1",
	}, H57HashFn)
	if err != nil {
		t.Fatalf("compute cache key: %v", err)
	}
	resume.Update(ResumeState{WidgetID: "widget-1", StateVersion: 3})
	store.Set(CacheEntry[map[string]any]{
		CacheKey: cacheKey,
		Data: map[string]any{
			"widget_id":     "widget-1",
			"state_version": 2,
			"name":          "stale-cache",
		},
		Metadata: CreateCacheMetadata(CacheSourceCache, 500, 10000, "v1", "v1", "spec", "ns", false),
	})
	calls := 0
	engine := NewReadThroughCacheEngine(
		store,
		CacheParity{SchemaVersion: "v1", DataVersion: "v1", SpecChecksum: "spec", CacheNamespace: "ns"},
		WithResumeStore[map[string]any](resume),
		WithNowFn[map[string]any](func() int64 { return 1000 }),
	)
	request := CacheRequest[map[string]any]{
		KeyInput: CacheKeyInput{Namespace: "profile", OperationID: "get", Payload: map[string]any{"userId": "u1"}, SchemaVersion: "v1", SpecChecksum: "spec", UserScope: "u1"},
		HashFn:   func([]byte) string { return cacheKey },
		FetchFromAPI: func(context.Context) (ApiFetchResult[map[string]any], error) {
			calls++
			ttl := int64(60000)
			return ApiFetchResult[map[string]any]{Data: map[string]any{"name": "fresh-api"}, TTLMS: &ttl}, nil
		},
	}
	result, err := engine.Execute(context.Background(), request)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if calls != 1 || result.Source != CacheSourceAPI {
		t.Fatalf("expected API bypass due to stale state alignment")
	}
}

type throwingPersistentStore[T any] struct{ setAttempts int }

func (s *throwingPersistentStore[T]) Get(string) (*CacheEntry[T], error) { return nil, nil }
func (s *throwingPersistentStore[T]) Set(CacheEntry[T]) error {
	s.setAttempts++
	return context.Canceled
}
func (s *throwingPersistentStore[T]) Delete(string) error             { return nil }
func (s *throwingPersistentStore[T]) Clear() error                    { return nil }
func (s *throwingPersistentStore[T]) PruneExpired(int64) (int, error) { return 0, nil }
func (s *throwingPersistentStore[T]) HydrateAllValid(int64, *int) ([]CacheEntry[T], error) {
	return nil, nil
}

func TestEngineContinuesWhenPersistentWriteFails(t *testing.T) {
	store := NewMemoryCacheStore[map[string]any](10, func() int64 { return 1000 })
	persist := &throwingPersistentStore[map[string]any]{}
	calls := 0
	engine := NewReadThroughCacheEngine(
		store,
		CacheParity{SchemaVersion: "v1", DataVersion: "v1", SpecChecksum: "spec", CacheNamespace: "ns"},
		WithPersistentStore[map[string]any](persist),
		WithNowFn[map[string]any](func() int64 { return 1000 }),
	)
	request := CacheRequest[map[string]any]{
		KeyInput: CacheKeyInput{Namespace: "profile", OperationID: "get", Payload: map[string]any{"userId": "u1"}, SchemaVersion: "v1", SpecChecksum: "spec", UserScope: "u1"},
		HashFn:   H57HashFn,
		FetchFromAPI: func(context.Context) (ApiFetchResult[map[string]any], error) {
			calls++
			ttl := int64(60000)
			return ApiFetchResult[map[string]any]{Data: map[string]any{"name": "alice"}, TTLMS: &ttl}, nil
		},
	}
	result, err := engine.Execute(context.Background(), request)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if result.Source != CacheSourceAPI || calls != 1 || persist.setAttempts != 1 {
		t.Fatalf("expected API result and one failed persistent write")
	}
}

func TestEngineReportsPersistentWriteError(t *testing.T) {
	store := NewMemoryCacheStore[map[string]any](10, func() int64 { return 1000 })
	persist := &throwingPersistentStore[map[string]any]{}
	var gotErr error
	engine := NewReadThroughCacheEngine(
		store,
		CacheParity{SchemaVersion: "v1", DataVersion: "v1", SpecChecksum: "spec", CacheNamespace: "ns"},
		WithPersistentStore[map[string]any](persist),
		WithNowFn[map[string]any](func() int64 { return 1000 }),
		WithInternalErrorHandler[map[string]any](func(err error) { gotErr = err }),
	)
	request := CacheRequest[map[string]any]{
		KeyInput: CacheKeyInput{Namespace: "profile", OperationID: "get", Payload: map[string]any{"userId": "u1"}, SchemaVersion: "v1", SpecChecksum: "spec", UserScope: "u1"},
		HashFn:   H57HashFn,
		FetchFromAPI: func(context.Context) (ApiFetchResult[map[string]any], error) {
			ttl := int64(60000)
			return ApiFetchResult[map[string]any]{Data: map[string]any{"name": "alice"}, TTLMS: &ttl}, nil
		},
	}
	if _, err := engine.Execute(context.Background(), request); err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if gotErr == nil || !strings.Contains(gotErr.Error(), "write persistent entry") {
		t.Fatalf("expected reported persistent write error")
	}
}

func TestEngineRejectsNonIntegerStateVersion(t *testing.T) {
	if _, ok := asInt64(2.5); ok {
		t.Fatalf("expected non-integer float to be rejected")
	}
	if _, ok := asInt64(2.0); !ok {
		t.Fatalf("expected integer-valued float to be accepted")
	}
}
