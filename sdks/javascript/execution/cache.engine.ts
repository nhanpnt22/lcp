import { createCacheMetadata, type CacheEntry } from "../entry";
import type { H57HashFunction } from "../key/cache.key";
import { computeCacheKey } from "../key/cache.key";
import type { CacheSingleFlight } from "../singleflight";
import type { MemoryCacheStore } from "../storage/cache.store.memory";
import type { IndexedDbCacheStore } from "../storage/cache.store.idb";
import { extractOacTtlMs } from "../ttl";
import { assertCacheEntryInvariants } from "../validation";
import {
  buildResumeHint,
  InMemoryResumeStateStore,
  type ResumeHint,
  type ResumeStateRecord,
  type ResumeStateStore,
  type WidgetStateMap
} from "../resume";
import {
  getExpiredStaleCandidate,
  resolveShortThresholdMs,
  safeIndexedDbDelete,
  safeIndexedDbGet,
  safeIndexedDbSet,
  safeMemoryGet,
  safeMemorySet,
  shouldPersistToIndexedDb,
  shouldBypassForStateAlignment,
  trackResumeState,
  toCacheResponse,
  triggerBackgroundRefresh
} from "./cache.engine.helpers";
import type {
  CacheParity,
  ReadThroughEngineOptions,
  ReadThroughRequest,
  ReadThroughResponse
} from "./cache.engine.types";

export type {
  FetchApiResult,
  ReadThroughEngineOptions,
  ReadThroughRequest,
  ReadThroughResponse
} from "./cache.engine.types";

export class ReadThroughCacheEngine<T = unknown> {
  private readonly memoryStore: MemoryCacheStore<T>;
  private readonly indexedDbStore?: IndexedDbCacheStore<T>;
  private readonly singleFlight?: CacheSingleFlight;
  private readonly now: () => number;
  private readonly parity: CacheParity;
  private readonly persistenceMode: "auto" | "memory-only" | "dual";
  private readonly shortThresholdMs: number;
  private readonly shouldPersistToIndexedDbOverride?: (entry: CacheEntry<T>) => boolean;
  private readonly resumeStore?: ResumeStateStore;
  private readonly resolveResumeState?: (params: {
    source: "API" | "CACHE";
    data: T;
    cacheKey: string;
    request: ReadThroughRequest<T>;
  }) => ResumeStateRecord | undefined;

  constructor(options: ReadThroughEngineOptions<T>) {
    this.memoryStore = options.memoryStore;
    this.indexedDbStore = options.indexedDbStore;
    this.singleFlight = options.singleFlight;
    this.now = options.now ?? (() => Date.now());
    this.parity = options.parity;
    this.persistenceMode = options.persistence?.mode ?? "dual";
    this.shortThresholdMs = resolveShortThresholdMs(options.persistence?.shortThresholdMs);
    this.shouldPersistToIndexedDbOverride = options.persistence?.shouldPersistToIndexedDb;
    if (options.resume) {
      this.resumeStore = options.resume.store ?? new InMemoryResumeStateStore();
      this.resolveResumeState = options.resume.resolveState;
    }
  }

  getWidgetStateMap(): WidgetStateMap {
    return this.resumeStore?.snapshot() ?? {};
  }

  clearWidgetStateMap(): void {
    this.resumeStore?.clear();
  }

  updateWidgetState(record: ResumeStateRecord): void {
    this.resumeStore?.update(record);
  }

  buildResumeHint(params: { traceId: string; h57Hash?: H57HashFunction }): ResumeHint {
    return buildResumeHint({
      traceId: params.traceId,
      widgetStateMap: this.getWidgetStateMap(),
      h57Hash: params.h57Hash
    });
  }

  async execute(request: ReadThroughRequest<T>): Promise<ReadThroughResponse<T>> {
    const cacheKey = computeCacheKey(request.keyInput, request.h57Hash);
    const allowStaleFallback = Boolean(request.allowStaleOnExpired);
    const staleCandidate = getExpiredStaleCandidate(this.memoryStore, cacheKey, this.now);

    const staleResponse = this.tryReturnStale(staleCandidate, allowStaleFallback, cacheKey, request);
    if (staleResponse) {
      return staleResponse;
    }

    const memoryResponse = this.tryReturnMemoryHit(cacheKey, staleCandidate, allowStaleFallback, request);
    if (memoryResponse) {
      return memoryResponse;
    }

    const idbResponse = await this.tryReturnIndexedDbHit(
      cacheKey,
      staleCandidate,
      allowStaleFallback,
      request
    );
    if (idbResponse) {
      return idbResponse;
    }

    return this.fetchWithSingleFlight(cacheKey, request);
  }

  private tryReturnStale(
    staleCandidate: CacheEntry<T> | undefined,
    allowStaleFallback: boolean,
    cacheKey: string,
    request: ReadThroughRequest<T>
  ): ReadThroughResponse<T> | undefined {
    if (!staleCandidate || !allowStaleFallback) {
      return undefined;
    }

    if (this.shouldBypassStateAlignment(staleCandidate.data, request)) {
      return undefined;
    }

    triggerBackgroundRefresh({ request, cacheKey });
    this.trackResumeState("CACHE", staleCandidate.data, cacheKey, request);
    return toCacheResponse(cacheKey, staleCandidate, true);
  }

  private tryReturnMemoryHit(
    cacheKey: string,
    staleCandidate: CacheEntry<T> | undefined,
    allowStaleFallback: boolean,
    request: ReadThroughRequest<T>
  ): ReadThroughResponse<T> | undefined {
    const memoryRead = safeMemoryGet({
      memoryStore: this.memoryStore,
      cacheKey,
      staleEntry: staleCandidate,
      allowStale: allowStaleFallback
    });
    if (!memoryRead.entry) {
      return undefined;
    }

    if (this.shouldBypassStateAlignment(memoryRead.entry.data, request)) {
      return undefined;
    }

    this.trackResumeState("CACHE", memoryRead.entry.data, cacheKey, request);
    return toCacheResponse(cacheKey, memoryRead.entry, memoryRead.stale);
  }

  private async tryReturnIndexedDbHit(
    cacheKey: string,
    staleCandidate: CacheEntry<T> | undefined,
    allowStaleFallback: boolean,
    request: ReadThroughRequest<T>
  ): Promise<ReadThroughResponse<T> | undefined> {
    const idbRead = await safeIndexedDbGet({
      indexedDbStore: this.indexedDbStore,
      cacheKey,
      staleEntry: staleCandidate,
      allowStale: allowStaleFallback,
      parity: this.parity,
      onInvalidEntry: async (invalidKey) => {
        await safeIndexedDbDelete(this.indexedDbStore, invalidKey);
      }
    });
    if (!idbRead.entry) {
      return undefined;
    }

    if (this.shouldBypassStateAlignment(idbRead.entry.data, request)) {
      return undefined;
    }

    if (idbRead.hydrateMemory) {
      safeMemorySet(this.memoryStore, idbRead.entry);
    }
    this.trackResumeState("CACHE", idbRead.entry.data, cacheKey, request);
    return toCacheResponse(cacheKey, idbRead.entry, idbRead.stale);
  }

  private fetchWithSingleFlight(
    cacheKey: string,
    request: ReadThroughRequest<T>
  ): Promise<ReadThroughResponse<T>> {
    const runFetch = () => this.fetchAndPopulate(cacheKey, request);
    if (this.singleFlight) {
      return this.singleFlight.run(cacheKey, runFetch);
    }
    return runFetch();
  }

  private async fetchAndPopulate(
    cacheKey: string,
    request: ReadThroughRequest<T>
  ): Promise<ReadThroughResponse<T>> {
    const api = await request.fetchFromApi();
    const ttlMs = api.ttlMs ?? (api.headers ? extractOacTtlMs(api.headers) : undefined);

    // Missing TTL is authoritative bypass.
    if (ttlMs === undefined) {
      return {
        cacheKey,
        source: "API",
        data: api.data,
        stale: false
      };
    }

    const createdAt = this.now();
    const metadata = createCacheMetadata({
      source: "API",
      createdAt,
      ttlMs,
      schemaVersion: this.parity.schemaVersion,
      dataVersion: this.parity.dataVersion,
      specChecksum: this.parity.specChecksum,
      cacheNamespace: this.parity.cacheNamespace,
      compressed: false
    });

    const entry: CacheEntry<T> = {
      cache_key: cacheKey,
      data: api.data,
      metadata
    };

    assertCacheEntryInvariants(entry, {
      parity: {
        schema_version: this.parity.schemaVersion,
        spec_checksum: this.parity.specChecksum,
        cache_namespace: this.parity.cacheNamespace
      },
      expectedCacheKey: cacheKey,
      requireNoSensitiveData: true,
      requireNoTraceInData: true
    });

    safeMemorySet(this.memoryStore, entry);
    if (this.shouldPersistToIndexedDb(entry)) {
      await safeIndexedDbSet(this.indexedDbStore, entry);
    }

    this.trackResumeState("API", api.data, cacheKey, request);

    return {
      cacheKey,
      source: "API",
      data: api.data,
      stale: false
    };
  }

  private shouldPersistToIndexedDb(entry: CacheEntry<T>): boolean {
    return shouldPersistToIndexedDb({
      indexedDbStore: this.indexedDbStore,
      persistenceMode: this.persistenceMode,
      shortThresholdMs: this.shortThresholdMs,
      entry,
      override: this.shouldPersistToIndexedDbOverride
    });
  }

  private trackResumeState(
    source: "API" | "CACHE",
    data: T,
    cacheKey: string,
    request: ReadThroughRequest<T>
  ): void {
    trackResumeState({
      source,
      data,
      cacheKey,
      request,
      resumeStore: this.resumeStore,
      resolveResumeState: this.resolveResumeState
    });
  }

  private shouldBypassStateAlignment(data: T, request: ReadThroughRequest<T>): boolean {
    return shouldBypassForStateAlignment({
      data,
      request,
      resumeStore: this.resumeStore
    });
  }
}
