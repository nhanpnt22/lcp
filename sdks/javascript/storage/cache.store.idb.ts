import type { CacheEntry } from "../entry";
import { deterministicSerialize } from "../consistency";
import { assertH57CacheKey, isH57CacheKey } from "../key/cache.key.validation";

const DEFAULT_DB_NAME = "lcp_local_cache";
const DEFAULT_STORE_NAME = "cache_entries";
const DEFAULT_DB_VERSION = 1;
const EXPIRES_AT_INDEX = "by_expires_at";

interface IdbRequestLike<T = unknown> {
  result: T;
  error?: unknown;
  onsuccess: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

interface IdbCursorLike {
  value: unknown;
  continue: () => void;
}

interface IdbObjectStoreLike {
  get: (key: string) => IdbRequestLike;
  put: (value: unknown) => IdbRequestLike;
  delete: (key: string) => IdbRequestLike;
  clear: () => IdbRequestLike;
  openCursor: () => IdbRequestLike<IdbCursorLike | null>;
  index: (name: string) => {
    openCursor: (range?: unknown) => IdbRequestLike<IdbCursorLike | null>;
  };
}

interface IdbTransactionLike {
  objectStore: (name: string) => IdbObjectStoreLike;
}

interface IdbDatabaseLike {
  objectStoreNames: { contains: (name: string) => boolean };
  createObjectStore: (name: string, options: { keyPath: string }) => IdbObjectStoreLike;
  transaction: (storeName: string, mode: "readonly" | "readwrite") => IdbTransactionLike;
}

interface IdbOpenDbRequestLike {
  result: IdbDatabaseLike;
  error?: unknown;
  onsuccess: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onupgradeneeded: ((event: unknown) => void) | null;
}

interface IndexedDbFactoryLike {
  open: (name: string, version: number) => IdbOpenDbRequestLike;
}

interface PersistedCacheRow {
  cache_key: string;
  entry_json: string;
  expires_at: number;
  updated_at: number;
}

export interface IndexedDbStoreOptions {
  dbName?: string;
  storeName?: string;
  dbVersion?: number;
  now?: () => number;
  indexedDbFactory?: IndexedDbFactoryLike;
  validateEntry?: (entry: CacheEntry<unknown>) => boolean;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "unknown error";
    }
  }
  return "unknown error";
}

function requestAsPromise<T = unknown>(request: IdbRequestLike<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error(`IndexedDB request failed: ${toErrorMessage(request.error)}`));
  });
}

function getIndexedDbFactory(indexedDbFactory?: IndexedDbFactoryLike): IndexedDbFactoryLike {
  if (indexedDbFactory) {
    return indexedDbFactory;
  }

  const globalFactory = (globalThis as { indexedDB?: IndexedDbFactoryLike }).indexedDB;
  if (!globalFactory) {
    throw new Error("IndexedDB is not available in this runtime");
  }

  return globalFactory;
}

export class IndexedDbCacheStore<T = unknown> {
  private readonly dbName: string;
  private readonly storeName: string;
  private readonly dbVersion: number;
  private readonly now: () => number;
  private readonly indexedDbFactory: IndexedDbFactoryLike;
  private readonly validateEntry?: (entry: CacheEntry<unknown>) => boolean;
  private dbPromise?: Promise<IdbDatabaseLike>;

  constructor(options: IndexedDbStoreOptions = {}) {
    this.dbName = options.dbName ?? DEFAULT_DB_NAME;
    this.storeName = options.storeName ?? DEFAULT_STORE_NAME;
    this.dbVersion = options.dbVersion ?? DEFAULT_DB_VERSION;
    this.now = options.now ?? (() => Date.now());
    this.indexedDbFactory = getIndexedDbFactory(options.indexedDbFactory);
    this.validateEntry = options.validateEntry;
  }

  async get(cacheKey: string): Promise<CacheEntry<T> | undefined> {
    const normalizedKey = assertH57CacheKey(cacheKey, "indexeddb.get");
    const row = await this.getRow(normalizedKey);
    if (!row) {
      return undefined;
    }

    if (this.now() >= row.expires_at) {
      await this.delete(normalizedKey);
      return undefined;
    }

    const entry = this.deserializeEntry(row.entry_json, normalizedKey);
    if (!entry) {
      await this.delete(normalizedKey);
      return undefined;
    }

    return entry;
  }

  async set(entry: CacheEntry<T>): Promise<void> {
    const normalizedKey = assertH57CacheKey(entry.cache_key, "indexeddb.set");
    const row: PersistedCacheRow = {
      cache_key: normalizedKey,
      entry_json: deterministicSerialize({ ...entry, cache_key: normalizedKey }),
      expires_at: entry.metadata.expires_at,
      updated_at: this.now()
    };

    await this.withStore("readwrite", async (store) => {
      await requestAsPromise(store.put(row));
    });
  }

  async delete(cacheKey: string): Promise<void> {
    const normalizedKey = assertH57CacheKey(cacheKey, "indexeddb.delete");
    await this.withStore("readwrite", async (store) => {
      await requestAsPromise(store.delete(normalizedKey));
    });
  }

  async clear(): Promise<void> {
    await this.withStore("readwrite", async (store) => {
      await requestAsPromise(store.clear());
    });
  }

  async pruneExpired(): Promise<number> {
    const now = this.now();
    const keys = await this.listExpiredKeys(now);
    for (const key of keys) {
      await this.delete(key);
    }
    return keys.length;
  }

  async hydrateAllValid(limit?: number): Promise<CacheEntry<T>[]> {
    const max = limit && limit > 0 ? Math.floor(limit) : Number.POSITIVE_INFINITY;
    const out: CacheEntry<T>[] = [];
    const now = this.now();

    await this.withStore("readonly", async (store) => {
      const request = store.openCursor();

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || out.length >= max) {
            resolve();
            return;
          }

          const row = cursor.value as PersistedCacheRow;
          if (row.expires_at > now) {
            const entry = this.deserializeEntry(row.entry_json, row.cache_key);
            if (entry) {
              out.push(entry);
            }
          }

          cursor.continue();
        };

        request.onerror = () => {
          reject(new Error(`IndexedDB cursor failed: ${toErrorMessage(request.error)}`));
        };
      });
    });

    return out;
  }

  private async getRow(cacheKey: string): Promise<PersistedCacheRow | undefined> {
    return this.withStore("readonly", async (store) => {
      const row = await requestAsPromise<PersistedCacheRow | undefined>(
        store.get(cacheKey) as IdbRequestLike<PersistedCacheRow | undefined>
      );
      return row;
    });
  }

  private deserializeEntry(entryJson: string, expectedCacheKey: string): CacheEntry<T> | undefined {
    let parsed: CacheEntry<T>;
    try {
      parsed = JSON.parse(entryJson) as CacheEntry<T>;
    } catch {
      return undefined;
    }

    if (parsed?.cache_key !== expectedCacheKey) {
      return undefined;
    }

    if (!isH57CacheKey(parsed.cache_key)) {
      return undefined;
    }

    if (this.validateEntry && !this.validateEntry(parsed)) {
      return undefined;
    }

    return parsed;
  }

  private async listExpiredKeys(now: number): Promise<string[]> {
    return this.withStore("readonly", async (store) => {
      const index = store.index(EXPIRES_AT_INDEX);
      const request = index.openCursor();
      const keys: string[] = [];

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }

          const row = cursor.value as PersistedCacheRow;
          if (row.expires_at <= now) {
            keys.push(row.cache_key);
          }

          cursor.continue();
        };

        request.onerror = () => {
          reject(new Error(`IndexedDB cursor failed: ${toErrorMessage(request.error)}`));
        };
      });

      return keys;
    });
  }

  private async withStore<R>(
    mode: "readonly" | "readwrite",
    run: (store: IdbObjectStoreLike) => Promise<R>
  ): Promise<R> {
    const db = await this.getDb();
    const tx = db.transaction(this.storeName, mode);
    const store = tx.objectStore(this.storeName);
    return run(store);
  }

  private async getDb(): Promise<IdbDatabaseLike> {
    this.dbPromise ??= this.openDb();
    return this.dbPromise;
  }

  private async openDb(): Promise<IdbDatabaseLike> {
    const openRequest = this.indexedDbFactory.open(this.dbName, this.dbVersion);

    return new Promise<IdbDatabaseLike>((resolve, reject) => {
      openRequest.onupgradeneeded = () => {
        const db = openRequest.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "cache_key" });
          // Needed for deterministic TTL cleanup scans.
          (store as { createIndex?: (name: string, keyPath: string) => void }).createIndex?.(
            EXPIRES_AT_INDEX,
            "expires_at"
          );
        }
      };

      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => {
        reject(new Error(`IndexedDB open failed: ${toErrorMessage(openRequest.error)}`));
      };
    });
  }
}
