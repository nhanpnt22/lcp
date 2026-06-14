import { mkdir, readdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CacheEntry } from "@sdp/lcp-javascript-sdk";
import type { NodePersistentStore } from "../types.js";
import { assertH57CacheKey } from "../cache.key.validation.js";

/**
 * Persists cache entries as JSON files under rootDir.
 * Works for local disks and Cloud Storage FUSE mount paths.
 */
export class FilePersistentStore<T = unknown> implements NodePersistentStore<T> {
  private readonly rootDir: string;
  private readonly now: () => number;

  constructor(rootDir: string, now?: () => number) {
    if (!rootDir.trim()) {
      throw new Error("rootDir is required");
    }
    this.rootDir = rootDir;
    this.now = now ?? (() => Date.now());
  }

  private filePath(cacheKey: string): string {
    return join(this.rootDir, `${cacheKey}.json`);
  }

  private async readEntryFile(filePath: string): Promise<CacheEntry<T> | undefined> {
    try {
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return undefined;
    }
  }

  async get(cacheKey: string): Promise<CacheEntry<T> | undefined> {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-file.get");
    const entry = await this.readEntryFile(this.filePath(normalizedKey));
    if (entry?.cache_key !== normalizedKey) {
      return undefined;
    }
    if (this.now() >= entry.metadata.expires_at) {
      await this.delete(normalizedKey);
      return undefined;
    }
    return entry;
  }

  async set(entry: CacheEntry<T>): Promise<void> {
    const normalizedKey = assertH57CacheKey(entry.cache_key, "node-file.set");
    await mkdir(this.rootDir, { recursive: true });
    const filePath = this.filePath(normalizedKey);
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify({ ...entry, cache_key: normalizedKey }), "utf8");
    await rename(tmpPath, filePath);
  }

  async delete(cacheKey: string): Promise<void> {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-file.delete");
    try {
      await unlink(this.filePath(normalizedKey));
    } catch (error) {
      if ((error as { code?: string }).code !== "ENOENT") throw error;
    }
  }

  async clear(): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(this.rootDir);
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return;
      throw error;
    }
    await Promise.all(
      entries
        .filter((name) => name.endsWith(".json"))
        .map((name) => rm(join(this.rootDir, name), { force: true }))
    );
  }

  async pruneExpired(nowMs?: number): Promise<number> {
    const threshold = nowMs ?? this.now();
    let entries: string[];
    try {
      entries = await readdir(this.rootDir);
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return 0;
      throw error;
    }
    let removed = 0;
    for (const name of entries) {
      if (!name.endsWith(".json")) continue;
      const filePath = join(this.rootDir, name);
      const entry = await this.readEntryFile(filePath);
      if (!entry) continue;
      if (threshold >= entry.metadata.expires_at) {
        await rm(filePath, { force: true });
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
    let entries: string[];
    try {
      entries = await readdir(this.rootDir);
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") return [];
      throw error;
    }
    const out: CacheEntry<T>[] = [];
    for (const name of entries.filter((n) => n.endsWith(".json")).sort((a, b) => a.localeCompare(b))) {
      const entry = await this.readEntryFile(join(this.rootDir, name));
      if (!entry) continue;
      if (this.now() < entry.metadata.expires_at) {
        out.push(entry);
      }
      if (out.length >= max) break;
    }
    return out;
  }
}
