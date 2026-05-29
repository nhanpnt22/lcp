import '../entry/cache_entry.dart';
import '../key/cache_key.dart';
import '../resume/cache_resume.dart';
import '../singleflight/cache_single_flight.dart';
import '../storage/memory_cache_store.dart';
import '../storage/persistent_cache_store.dart';
import '../ttl/cache_ttl.dart';
import '../validation/cache_validation.dart';

enum CachePersistenceMode { auto, memoryOnly, dual }

class CacheParity {
  const CacheParity({
    required this.schemaVersion,
    required this.dataVersion,
    required this.specChecksum,
    required this.cacheNamespace,
  });

  final String schemaVersion;
  final String dataVersion;
  final String specChecksum;
  final String cacheNamespace;
}

class CachePersistenceConfig<T> {
  const CachePersistenceConfig({
    this.mode = CachePersistenceMode.dual,
    this.shortThresholdMs = 300000,
    this.shouldPersistToPersistentStore,
  });

  final CachePersistenceMode mode;
  final int shortThresholdMs;
  final bool Function(CacheEntry<T> entry)? shouldPersistToPersistentStore;
}

class ApiFetchResult<T> {
  const ApiFetchResult({
    required this.data,
    this.ttlMs,
    this.headers,
  });

  final T data;
  final int? ttlMs;
  final Map<String, String?>? headers;
}

class CacheTraceContext {
  const CacheTraceContext({
    this.requestId,
  });

  final String? requestId;
}

class CacheRequest<T> {
  const CacheRequest({
    required this.keyInput,
    required this.hashFn,
    required this.fetchFromApi,
    this.allowStaleOnExpired = false,
    this.resumeState,
    this.trace,
    this.onBackgroundRefresh,
  });

  final CacheKeyInput keyInput;
  final HashFn hashFn;
  final Future<ApiFetchResult<T>> Function() fetchFromApi;
  final bool allowStaleOnExpired;
  final ResumeState? resumeState;
  final CacheTraceContext? trace;
  final void Function(BackgroundRefreshSignal signal)? onBackgroundRefresh;
}

class BackgroundRefreshSignal {
  const BackgroundRefreshSignal({
    required this.cacheKey,
    required this.requestId,
  });

  final String cacheKey;
  final String? requestId;
}

class CacheExecutionResult<T> {
  const CacheExecutionResult({
    required this.cacheKey,
    required this.source,
    required this.data,
    required this.stale,
  });

  final String cacheKey;
  final CacheSource source;
  final T data;
  final bool stale;
}

typedef ResolveResumeState<T> = ResumeState? Function({
  required CacheSource source,
  required T data,
  required String cacheKey,
  required CacheRequest<T> request,
});

class ReadThroughCacheEngine<T> {
  ReadThroughCacheEngine({
    required MemoryCacheStore<T> memoryStore,
    required CacheParity parity,
    PersistentCacheStore<T>? persistentStore,
    CacheSingleFlight<CacheExecutionResult<T>>? singleFlight,
    CachePersistenceConfig<T> persistence = const CachePersistenceConfig(),
    InMemoryResumeStateStore? resumeStore,
    ResolveResumeState<T>? resolveResumeState,
    int Function()? now,
  })  : _memoryStore = memoryStore,
        _persistentStore = persistentStore,
        _singleFlight = singleFlight,
        _parity = parity,
        _persistence = persistence,
        _resumeStore = resumeStore,
        _resolveResumeState = resolveResumeState,
        _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final MemoryCacheStore<T> _memoryStore;
  final PersistentCacheStore<T>? _persistentStore;
  final CacheSingleFlight<CacheExecutionResult<T>>? _singleFlight;
  final CacheParity _parity;
  final CachePersistenceConfig<T> _persistence;
  final InMemoryResumeStateStore? _resumeStore;
  final ResolveResumeState<T>? _resolveResumeState;
  final int Function() _now;

  Map<String, int> getWidgetStateMap() => _resumeStore?.snapshot() ?? {};

  void clearWidgetStateMap() => _resumeStore?.clear();

  void updateWidgetState(ResumeState state) => _resumeStore?.update(state);

  Map<String, Object> buildResumeHintForTrace({
    required String traceId,
    HashFn? hashFn,
  }) {
    return buildResumeHint(
      traceId: traceId,
      widgetStateMap: getWidgetStateMap(),
      hashFn: hashFn,
    );
  }

  Future<CacheExecutionResult<T>> execute(CacheRequest<T> request) async {
    final cacheKey = computeCacheKey(request.keyInput, request.hashFn);
    final staleEntry = _expiredPeek(cacheKey);

    if (staleEntry != null &&
        request.allowStaleOnExpired &&
        !_shouldBypassStateAlignment(request, staleEntry.data)) {
      _emitBackgroundRefreshSignal(request, cacheKey);
      _trackResumeState(
        source: CacheSource.cache,
        data: staleEntry.data,
        cacheKey: cacheKey,
        request: request,
      );
      return CacheExecutionResult(
        cacheKey: cacheKey,
        source: CacheSource.cache,
        data: staleEntry.data,
        stale: true,
      );
    }

    final memoryHit = _memoryStore.get(cacheKey);
    if (memoryHit != null &&
        !_shouldBypassStateAlignment(request, memoryHit.data)) {
      _trackResumeState(
        source: CacheSource.cache,
        data: memoryHit.data,
        cacheKey: cacheKey,
        request: request,
      );
      return CacheExecutionResult(
        cacheKey: cacheKey,
        source: CacheSource.cache,
        data: memoryHit.data,
        stale: false,
      );
    }

    final persistentStore = _persistentStore;
    if (persistentStore != null) {
      final persisted = await persistentStore.get(cacheKey);
      if (persisted != null) {
        final isValid = _isValidEntry(persisted, cacheKey);
        if (!isValid) {
          await persistentStore.delete(cacheKey);
        } else if (!_shouldBypassStateAlignment(request, persisted.data)) {
          _memoryStore.set(persisted);
          _trackResumeState(
            source: CacheSource.cache,
            data: persisted.data,
            cacheKey: cacheKey,
            request: request,
          );
          return CacheExecutionResult(
            cacheKey: cacheKey,
            source: CacheSource.cache,
            data: persisted.data,
            stale: false,
          );
        }
      }
    }

    Future<CacheExecutionResult<T>> runFetch() =>
        _fetchAndPopulate(cacheKey, request);
    final singleFlight = _singleFlight;
    if (singleFlight != null) {
      return singleFlight.run(cacheKey, runFetch);
    }
    return runFetch();
  }

  bool _isValidEntry(CacheEntry<T> entry, String cacheKey) {
    try {
      assertCacheEntryInvariants(
        entry,
        ValidationOptions(
          parity: CacheMetadataParityExpectation(
            schemaVersion: _parity.schemaVersion,
            specChecksum: _parity.specChecksum,
            cacheNamespace: _parity.cacheNamespace,
          ),
          expectedCacheKey: cacheKey,
        ),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  CacheEntry<T>? _expiredPeek(String cacheKey) {
    final entry = _memoryStore.peek(cacheKey);
    if (entry == null) return null;
    final eval = evaluateTtl(
      createdAt: entry.metadata.createdAt,
      now: _now(),
      ttlMs: entry.metadata.ttlMs,
    );
    if (eval.status == TtlStatus.expired) return entry;
    return null;
  }

  bool _shouldBypassStateAlignment(CacheRequest<T> request, T data) {
    if (data is! Map) return false;

    final widgetId = data['widget_id'];
    final stateVersion = data['state_version'];
    if (widgetId is! String || stateVersion is! int || stateVersion < 0) {
      return false;
    }

    final current = _resumeStore?.snapshot()[widgetId];
    if (current != null && current > stateVersion) {
      return true;
    }

    final resumeState = request.resumeState;
    if (resumeState != null &&
        widgetId == resumeState.widgetId &&
        stateVersion < resumeState.stateVersion) {
      return true;
    }

    return false;
  }

  Future<CacheExecutionResult<T>> _fetchAndPopulate(
      String cacheKey, CacheRequest<T> request) async {
    final apiResult = await request.fetchFromApi();
    final ttlMs = apiResult.ttlMs ??
        (apiResult.headers != null
            ? extractOacTtlMs(apiResult.headers!)
            : null);

    if (ttlMs == null) {
      _trackResumeState(
        source: CacheSource.api,
        data: apiResult.data,
        cacheKey: cacheKey,
        request: request,
      );
      return CacheExecutionResult(
        cacheKey: cacheKey,
        source: CacheSource.api,
        data: apiResult.data,
        stale: false,
      );
    }

    final metadata = createCacheMetadata(
      source: CacheSource.api,
      createdAt: _now(),
      ttlMs: ttlMs,
      schemaVersion: _parity.schemaVersion,
      dataVersion: _parity.dataVersion,
      specChecksum: _parity.specChecksum,
      cacheNamespace: _parity.cacheNamespace,
    );

    final entry = CacheEntry<T>(
      cacheKey: cacheKey,
      data: apiResult.data,
      metadata: metadata,
    );

    assertCacheEntryInvariants(
      entry,
      ValidationOptions(
        parity: CacheMetadataParityExpectation(
          schemaVersion: _parity.schemaVersion,
          specChecksum: _parity.specChecksum,
          cacheNamespace: _parity.cacheNamespace,
        ),
        expectedCacheKey: cacheKey,
      ),
    );

    _safeMemorySet(entry);
    if (_shouldPersistToPersistentStore(entry)) {
      await _safePersistentSet(entry);
    }

    _trackResumeState(
      source: CacheSource.api,
      data: apiResult.data,
      cacheKey: cacheKey,
      request: request,
    );
    return CacheExecutionResult(
      cacheKey: cacheKey,
      source: CacheSource.api,
      data: apiResult.data,
      stale: false,
    );
  }

  bool _shouldPersistToPersistentStore(CacheEntry<T> entry) {
    if (_persistentStore == null) return false;

    final override = _persistence.shouldPersistToPersistentStore;
    if (override != null) return override(entry);

    switch (_persistence.mode) {
      case CachePersistenceMode.memoryOnly:
        return false;
      case CachePersistenceMode.dual:
        return true;
      case CachePersistenceMode.auto:
        return entry.metadata.ttlMs > _persistence.shortThresholdMs;
    }
  }

  void _emitBackgroundRefreshSignal(CacheRequest<T> request, String cacheKey) {
    final callback = request.onBackgroundRefresh;
    if (callback == null) return;
    Future<void>.microtask(() {
      callback(
        BackgroundRefreshSignal(
          cacheKey: cacheKey,
          requestId: request.trace?.requestId,
        ),
      );
    });
  }

  void _trackResumeState({
    required CacheSource source,
    required T data,
    required String cacheKey,
    required CacheRequest<T> request,
  }) {
    final store = _resumeStore;
    if (store == null) return;

    final resumeState = request.resumeState;
    if (resumeState != null) {
      store.update(resumeState);
      return;
    }

    try {
      final derived = _resolveResumeState?.call(
        source: source,
        data: data,
        cacheKey: cacheKey,
        request: request,
      );
      if (derived != null) {
        store.update(derived);
      }
    } catch (_) {
      // Resume hints are advisory and must not affect execution semantics.
    }
  }

  void _safeMemorySet(CacheEntry<T> entry) {
    try {
      _memoryStore.set(entry);
    } catch (_) {
      // Memory write failures are non-authoritative and must not block execution.
    }
  }

  Future<void> _safePersistentSet(CacheEntry<T> entry) async {
    final persistentStore = _persistentStore;
    if (persistentStore == null) return;

    try {
      await persistentStore.set(entry);
    } catch (_) {
      // Persistent write failures are optional and must not block execution.
    }
  }
}
