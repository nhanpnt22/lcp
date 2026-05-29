import { createRequire } from "node:module";
import type { CacheEntry } from "@sdp/lcp-javascript-sdk";
import type { NodePersistentStore } from "../types.js";
import { assertH57CacheKey } from "../cache.key.validation.js";

const require = createRequire(import.meta.url);

type StorageBucket = {
  file: (name: string) => {
    save: (contents: string, options?: { resumable?: boolean; contentType?: string; userProject?: string }) => Promise<void>;
    exists: (options?: { userProject?: string }) => Promise<[boolean]>;
    download: (options?: { userProject?: string }) => Promise<[Buffer]>;
    delete: (options?: { ignoreNotFound?: boolean; userProject?: string }) => Promise<void>;
  };
  deleteFiles: (options?: { force?: boolean; prefix?: string; userProject?: string }) => Promise<void>;
  getFiles: (options?: { prefix?: string; userProject?: string }) => Promise<[Array<{ name: string; download: (options?: { userProject?: string }) => Promise<[Buffer]>; delete: (options?: { ignoreNotFound?: boolean; userProject?: string }) => Promise<void> }>]>
};

type StorageClient = {
  bucket: (name: string) => StorageBucket;
};

function parseGcsUri(uri: string): { bucket: string; prefix: string } {
  const trimmed = uri.trim();
  if (!trimmed.startsWith("gs://")) {
    throw new Error("cloudStorageUri must start with gs://");
  }
  const rest = trimmed.slice("gs://".length);
  if (!rest || rest.startsWith("/")) {
    throw new Error("cloudStorageUri bucket is required");
  }
  const slash = rest.indexOf("/");
  if (slash < 0) {
    const bucket = rest.trim();
    if (!bucket) {
      throw new Error("cloudStorageUri bucket is required");
    }
    return { bucket, prefix: "" };
  }
  const bucket = rest.slice(0, slash).trim();
  if (!bucket) {
    throw new Error("cloudStorageUri bucket is required");
  }
  return { bucket, prefix: rest.slice(slash + 1).replace(/^\/+|\/+$/g, "") };
}

export class CloudStoragePersistentStore<T = unknown> implements NodePersistentStore<T> {
  private readonly bucket: StorageBucket;
  private readonly prefix: string;
  private readonly userProject?: string;
  private readonly now: () => number;

  constructor(options: {
    cloudStorageUri: string;
    credentialsFile?: string;
    projectId?: string;
    enableUserProject?: boolean;
    now?: () => number;
  }) {
    const normalizedProjectId = options.projectId?.trim() || "";
    if (options.enableUserProject && !normalizedProjectId) {
      throw new Error("projectId is required when enableUserProject=true");
    }
    const { Storage } = require("@google-cloud/storage");
    const parsed = parseGcsUri(options.cloudStorageUri);
    const client = new Storage({
      projectId: normalizedProjectId || undefined,
      keyFilename: options.credentialsFile || undefined
    }) as StorageClient;
    this.bucket = client.bucket(parsed.bucket);
    this.prefix = parsed.prefix;
    this.userProject = options.enableUserProject ? normalizedProjectId : undefined;
    this.now = options.now ?? (() => Date.now());
  }

  private requestOptions(): { userProject?: string } {
    return this.userProject ? { userProject: this.userProject } : {};
  }

  private decodeEntryFromBuffer(buf: Buffer, context: string): CacheEntry<T> {
    try {
      return JSON.parse(buf.toString("utf8")) as CacheEntry<T>;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${context}: invalid JSON payload (${message})`);
    }
  }

  private objectName(cacheKey: string): string {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-cloud.objectName");
    if (!this.prefix) return normalizedKey;
    return `${this.prefix}/${normalizedKey}`;
  }

  private keyFromObjectName(objectName: string): string | undefined {
    const normalizedPrefix = this.prefix ? `${this.prefix}/` : "";
    if (normalizedPrefix && !objectName.startsWith(normalizedPrefix)) {
      return undefined;
    }
    const rawKey = normalizedPrefix ? objectName.slice(normalizedPrefix.length) : objectName;
    try {
      return assertH57CacheKey(rawKey, "node-cloud.objectName-key");
    } catch {
      throw new Error(`invalid cloud cache object filename (must be canonical H57): ${objectName}`);
    }
  }

  async get(cacheKey: string): Promise<CacheEntry<T> | undefined> {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-cloud.get");
    const file = this.bucket.file(this.objectName(normalizedKey));
    const [exists] = await file.exists(this.requestOptions());
    if (!exists) return undefined;
    const [buf] = await file.download(this.requestOptions());
    const entry = this.decodeEntryFromBuffer(buf, `cloud-storage read payload ${normalizedKey}`);
    if (entry.cache_key !== normalizedKey) {
      throw new Error(`cloud-storage payload key mismatch for ${normalizedKey}`);
    }
    if (this.now() >= entry.metadata.expires_at) {
      await this.delete(normalizedKey);
      return undefined;
    }
    return entry;
  }

  async set(entry: CacheEntry<T>): Promise<void> {
    const normalizedKey = assertH57CacheKey(entry.cache_key, "node-cloud.set");
    const file = this.bucket.file(this.objectName(normalizedKey));
    await file.save(JSON.stringify({ ...entry, cache_key: normalizedKey }), { resumable: false, contentType: "application/json", ...this.requestOptions() });
  }

  async delete(cacheKey: string): Promise<void> {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-cloud.delete");
    const file = this.bucket.file(this.objectName(normalizedKey));
    await file.delete({ ignoreNotFound: true, ...this.requestOptions() });
  }

  async clear(): Promise<void> {
    await this.bucket.deleteFiles({ force: true, prefix: this.prefix ? `${this.prefix}/` : undefined, ...this.requestOptions() });
  }

  async pruneExpired(nowMs?: number): Promise<number> {
    const threshold = nowMs ?? this.now();
    const [files] = await this.bucket.getFiles({ prefix: this.prefix ? `${this.prefix}/` : undefined, ...this.requestOptions() });
    let removed = 0;
    for (const file of files) {
      const keyFromName = this.keyFromObjectName(file.name);
      if (!keyFromName) {
        continue;
      }
      const [buf] = await file.download(this.requestOptions());
      const entry = this.decodeEntryFromBuffer(buf, `cloud-storage decode payload ${file.name}`);
      if (entry.cache_key !== keyFromName) {
        throw new Error(`cloud-storage payload key mismatch for ${file.name}`);
      }
      if (threshold >= entry.metadata.expires_at) {
        await file.delete({ ignoreNotFound: true, ...this.requestOptions() });
        removed++;
      }
    }
    return removed;
  }

  async hydrateAllValid(limit?: number): Promise<CacheEntry<T>[]> {
    const max =
      typeof limit === "number" && Number.isInteger(limit) && limit > 0
        ? limit
        : Number.MAX_SAFE_INTEGER;
    const [files] = await this.bucket.getFiles({ prefix: this.prefix ? `${this.prefix}/` : undefined, ...this.requestOptions() });
    const out: CacheEntry<T>[] = [];
    for (const file of files) {
      const keyFromName = this.keyFromObjectName(file.name);
      if (!keyFromName) {
        continue;
      }
      const [buf] = await file.download(this.requestOptions());
      const entry = this.decodeEntryFromBuffer(buf, `cloud-storage decode payload ${file.name}`);
      if (entry.cache_key !== keyFromName) {
        throw new Error(`cloud-storage payload key mismatch for ${file.name}`);
      }
      if (this.now() < entry.metadata.expires_at) {
        out.push(entry);
      }
      if (out.length >= max) break;
    }
    return out;
  }
}
