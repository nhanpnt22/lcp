import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createCacheMetadata, type CacheEntry } from "../../javascript/entry/cache.entry.js";
import { computeCacheKey, h57HashFn, type CacheKeyInput } from "../../javascript/key/cache.key.js";
import type { NodePersistentStore } from "../src/types.js";
import { NodeMemoryPersistentStore } from "../src/stores/memory.persistent.store.js";
import { SQLitePersistentStore } from "../src/stores/sqlite.persistent.store.js";
import { FilePersistentStore } from "../src/stores/file.persistent.store.js";

function h57Key(label: string): string {
  const input: CacheKeyInput = {
    namespace: "contract",
    operationId: label,
    payload: { suite: "persistent-store", label },
    schemaVersion: "v1",
    specChecksum: "spec-v1",
    userScope: "test-user"
  };
  return computeCacheKey(input, h57HashFn);
}

function makeEntry(cacheKey: string, value: string, createdAt: number, ttlMs: number): CacheEntry<{ value: string }> {
  return {
    cache_key: cacheKey,
    data: { value },
    metadata: createCacheMetadata({
      source: "API",
      createdAt,
      ttlMs,
      schemaVersion: "v1",
      dataVersion: "v1",
      specChecksum: "spec",
      cacheNamespace: "ns",
      compressed: false
    })
  };
}

function runStoreContractSuite(
  backend: "memory" | "sqlite" | "file",
  factory: () => { store: NodePersistentStore<{ value: string }>; cleanup: () => void }
): void {
  it(`${backend} set/get value after set`, async () => {
    const { store, cleanup } = factory();
    try {
      const key = h57Key("k1");
      await store.set(makeEntry(key, "alpha", 1000, 10000));
      const got = await store.get(key);
      expect(got?.data.value).toBe("alpha");
    } finally {
      cleanup();
    }
  });

  it(`${backend} overwrite existing key`, async () => {
    const { store, cleanup } = factory();
    try {
      const key = h57Key("k1");
      await store.set(makeEntry(key, "alpha", 1000, 10000));
      await store.set(makeEntry(key, "beta", 1000, 10000));
      const got = await store.get(key);
      expect(got?.data.value).toBe("beta");
    } finally {
      cleanup();
    }
  });

  it(`${backend} delete removes entry`, async () => {
    const { store, cleanup } = factory();
    try {
      const key = h57Key("k1");
      await store.set(makeEntry(key, "alpha", 1000, 10000));
      await store.delete(key);
      const got = await store.get(key);
      expect(got).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it(`${backend} clear removes all entries`, async () => {
    const { store, cleanup } = factory();
    try {
      const key1 = h57Key("k1");
      const key2 = h57Key("k2");
      await store.set(makeEntry(key1, "alpha", 1000, 10000));
      await store.set(makeEntry(key2, "beta", 1000, 10000));
      await store.clear();
      expect(await store.get(key1)).toBeUndefined();
      expect(await store.get(key2)).toBeUndefined();
    } finally {
      cleanup();
    }
  });

  it(`${backend} pruneExpired removes expired only`, async () => {
    const { store, cleanup } = factory();
    try {
      const expiredKey = h57Key("expired");
      const validKey = h57Key("valid");
      await store.set(makeEntry(expiredKey, "old", 0, 100));
      await store.set(makeEntry(validKey, "new", 1000, 10000));
      const removed = await store.pruneExpired(5000);
      expect(removed).toBe(1);
      expect(await store.get(expiredKey)).toBeUndefined();
      expect((await store.get(validKey))?.data.value).toBe("new");
    } finally {
      cleanup();
    }
  });

  it(`${backend} hydrateAllValid excludes expired and respects limit`, async () => {
    const { store, cleanup } = factory();
    try {
      const keyA = h57Key("a");
      const keyB = h57Key("b");
      const expiredKey = h57Key("expired");
      await store.set(makeEntry(keyA, "va", 1000, 10000));
      await store.set(makeEntry(keyB, "vb", 1000, 10000));
      await store.set(makeEntry(expiredKey, "vx", 0, 100));
      const all = await store.hydrateAllValid();
      const keys = all.map((entry) => entry.cache_key).sort((a, b) => a.localeCompare(b));
      expect(keys).toEqual([keyA, keyB].sort((a, b) => a.localeCompare(b)));
      const limited = await store.hydrateAllValid(1);
      expect(limited.length).toBe(1);
    } finally {
      cleanup();
    }
  });

  it(`${backend} set cache value for at least one value in storage`, async () => {
    const { store, cleanup } = factory();
    try {
      const key = h57Key("visible-evidence");
      await store.set(makeEntry(key, "alpha", 1000, 86400000));
      const got = await store.get(key);
      expect(got).toBeDefined();
      expect(got?.data.value).toBe("alpha");
    } finally {
      cleanup();
    }
  });
}

describe("node persistent store contract", () => {
  runStoreContractSuite("memory", () => {
    let now = 1000;
    return {
      store: new NodeMemoryPersistentStore<{ value: string }>({ now: () => now }),
      cleanup: () => {
        now = 0;
      }
    };
  });

  runStoreContractSuite("sqlite", () => {
    let now = 1000;
    const dir = mkdtempSync(join(tmpdir(), "lcp-nodejs-sqlite-"));
    const dbPath = join(dir, "lcp-cache.db");
    return {
      store: new SQLitePersistentStore<{ value: string }>(dbPath, () => now),
      cleanup: () => {
        now = 0;
        rmSync(dir, { recursive: true, force: true });
      }
    };
  });

  runStoreContractSuite("file", () => {
    let now = 1000;
    const dir = mkdtempSync(join(tmpdir(), "lcp-nodejs-file-"));
    return {
      store: new FilePersistentStore<{ value: string }>(dir, () => now),
      cleanup: () => {
        now = 0;
        rmSync(dir, { recursive: true, force: true });
      }
    };
  });
});
