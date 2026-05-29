import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCacheMetadata, type CacheEntry } from "../../javascript/entry/cache.entry.js";
import { computeCacheKey, h57HashFn, type CacheKeyInput } from "../../javascript/key/cache.key.js";
import type { NodePersistentStore } from "../src/types.js";
import { CloudStoragePersistentStore } from "../src/stores/cloud.storage.persistent.store.js";
import { NodeMemoryPersistentStore } from "../src/stores/memory.persistent.store.js";

const require = createRequire(import.meta.url);

function h57Key(label: string): string {
  const input: CacheKeyInput = {
    namespace: "contract",
    operationId: label,
    payload: { suite: "persistent-store-cloud", label },
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

function resolveCredentialsFile(): string {
  const fromEnv =
    process.env.GCP_SA_KEY?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() ||
    "";
  if (fromEnv) {
    if (existsSync(fromEnv)) return fromEnv;
    throw new Error(`credentials file not found: ${fromEnv}`);
  }

  const thisFile = fileURLToPath(import.meta.url);
  const fallback = resolve(dirname(thisFile), "../../go/config/testing/aiptesting-firebase-adminsdk-fbsvc-398b4932fd.json");
  if (existsSync(fallback)) return fallback;

  throw new Error("cloud credentials file not found; set GCP_SA_KEY or GOOGLE_APPLICATION_CREDENTIALS");
}

function resolveCloudUri(): string {
  return process.env.LCP_CROSS_NODE_CLOUD_STORAGE_URI?.trim() ||
    process.env.LCP_STORAGE_GCS_URI?.trim() ||
    "gs://aiptesting.firebasestorage.app/lcp";
}

function uniqueCloudUri(baseUri: string, label: string): string {
  const safe = label.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `${baseUri.replace(/\/+$/g, "")}/node-js-cloud/${safe}-${suffix}`;
}

function parseGcsUri(uri: string): { bucket: string; prefix: string } {
  const trimmed = uri.trim();
  if (!trimmed.startsWith("gs://")) {
    throw new Error("cloudStorageUri must start with gs://");
  }
  const rest = trimmed.slice("gs://".length);
  const slash = rest.indexOf("/");
  if (slash < 0) return { bucket: rest, prefix: "" };
  return { bucket: rest.slice(0, slash), prefix: rest.slice(slash + 1).replace(/^\/+|\/+$/g, "") };
}

function runStoreContractSuite(
  backend: "memory" | "cloud-storage",
  factory: () => { store: NodePersistentStore<{ value: string }>; cleanup: () => Promise<void> }
): void {
  const caseTimeoutMs = 30000;

  it(`${backend} set/get value after set`, async () => {
    const { store, cleanup } = factory();
    try {
      const key = h57Key("k1");
      await store.set(makeEntry(key, "alpha", 1000, 10000));
      const got = await store.get(key);
      expect(got?.data.value).toBe("alpha");
    } finally {
      await cleanup();
    }
  }, caseTimeoutMs);

  it(`${backend} overwrite existing key`, async () => {
    const { store, cleanup } = factory();
    try {
      const key = h57Key("k1");
      await store.set(makeEntry(key, "alpha", 1000, 10000));
      await store.set(makeEntry(key, "beta", 1000, 10000));
      const got = await store.get(key);
      expect(got?.data.value).toBe("beta");
    } finally {
      await cleanup();
    }
  }, caseTimeoutMs);

  it(`${backend} delete removes entry`, async () => {
    const { store, cleanup } = factory();
    try {
      const key = h57Key("k1");
      await store.set(makeEntry(key, "alpha", 1000, 10000));
      await store.delete(key);
      const got = await store.get(key);
      expect(got).toBeUndefined();
    } finally {
      await cleanup();
    }
  }, caseTimeoutMs);

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
      await cleanup();
    }
  }, caseTimeoutMs);

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
      await cleanup();
    }
  }, caseTimeoutMs);

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
      await cleanup();
    }
  }, caseTimeoutMs);

  it(`${backend} set cache value for at least one value in storage`, async () => {
    const { store, cleanup } = factory();
    try {
      const key = h57Key("visible-evidence");
      await store.set(makeEntry(key, "alpha", 1000, 86400000));
      const got = await store.get(key);
      expect(got).toBeDefined();
      expect(got?.data.value).toBe("alpha");
    } finally {
      await cleanup();
    }
  }, caseTimeoutMs);
}

describe("node persistent store cloud contract", () => {
  runStoreContractSuite("memory", () => {
    let now = 1000;
    const store = new NodeMemoryPersistentStore<{ value: string }>({ now: () => now });
    return {
      store,
      cleanup: async () => {
        now = 0;
      }
    };
  });

  runStoreContractSuite("cloud-storage", () => {
    let now = 1000;
    const cloudStorageUri = uniqueCloudUri(resolveCloudUri(), "contract");
    const credentialsFile = resolveCredentialsFile();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim() || "aiptesting";

    const store = new CloudStoragePersistentStore<{ value: string }>({
      cloudStorageUri,
      credentialsFile,
      projectId,
      now: () => now
    });

    return {
      store,
      cleanup: async () => {
        now = 0;
        await store.clear();
      }
    };
  });

  it("cloud-storage rejects non-H57 object filenames during hydrate and prune", async () => {
    const { Storage } = require("@google-cloud/storage");
    let now = 5000;
    const cloudStorageUri = uniqueCloudUri(resolveCloudUri(), "h57-filename-enforcement");
    const credentialsFile = resolveCredentialsFile();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim() || "aiptesting";
    const { bucket, prefix } = parseGcsUri(cloudStorageUri);

    const store = new CloudStoragePersistentStore<{ value: string }>({
      cloudStorageUri,
      credentialsFile,
      projectId,
      now: () => now
    });

    const client = new Storage({ projectId, keyFilename: credentialsFile });
    const badObjectName = prefix ? `${prefix}/not-h57-filename` : "not-h57-filename";

    try {
      const expiredKey = h57Key("expired-h57");
      const validKey = h57Key("valid-h57");
      await store.set(makeEntry(expiredKey, "old", 0, 100));
      await store.set(makeEntry(validKey, "new", 1000, 10000));

      // Seed a legacy/non-compliant object that must trigger strict validation errors.
      await client
        .bucket(bucket)
        .file(badObjectName)
        .save(JSON.stringify(makeEntry(validKey, "poison", 0, 100)), { resumable: false, contentType: "application/json" });

      await expect(store.hydrateAllValid()).rejects.toThrow(/canonical H57/);
      await expect(store.pruneExpired(5000)).rejects.toThrow(/canonical H57/);
      expect(await client.bucket(bucket).file(badObjectName).exists()).toEqual([true]);
    } finally {
      now = 0;
      await store.clear();
    }
  }, 30000);

  it("cloud-storage rejects payload key mismatch during hydrate and prune", async () => {
    const { Storage } = require("@google-cloud/storage");
    let now = 5000;
    const cloudStorageUri = uniqueCloudUri(resolveCloudUri(), "payload-key-mismatch");
    const credentialsFile = resolveCredentialsFile();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT?.trim() || "aiptesting";
    const { bucket, prefix } = parseGcsUri(cloudStorageUri);

    const store = new CloudStoragePersistentStore<{ value: string }>({
      cloudStorageUri,
      credentialsFile,
      projectId,
      now: () => now
    });

    const client = new Storage({ projectId, keyFilename: credentialsFile });

    try {
      const key = h57Key("payload-key-mismatch-seed");
      await store.set(makeEntry(key, "seed", 1000, 10000));

      const mismatchedFileName = prefix ? `${prefix}/${h57Key("filename-h57")}` : h57Key("filename-h57");
      await client
        .bucket(bucket)
        .file(mismatchedFileName)
        .save(JSON.stringify(makeEntry(h57Key("payload-h57-different"), "poison", 1000, 10000)), { resumable: false, contentType: "application/json" });

      await expect(store.hydrateAllValid()).rejects.toThrow(/payload key mismatch/);
      await expect(store.pruneExpired(5000)).rejects.toThrow(/payload key mismatch/);
    } finally {
      now = 0;
      await store.clear();
    }
  }, 30000);
});
