import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { CacheEntry } from "@sdp/lcp-javascript-sdk";
import type { NodePersistentStore } from "../types.js";
import { assertH57CacheKey } from "../cache.key.validation.js";

const require = createRequire(import.meta.url);

type BetterSqliteDatabase = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => unknown;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

export class SQLitePersistentStore<T = unknown> implements NodePersistentStore<T> {
  private readonly db: BetterSqliteDatabase;
  private readonly now: () => number;

  constructor(sqlitePath: string, now?: () => number) {
    if (!sqlitePath.trim()) {
      throw new Error("sqlitePath is required");
    }
    mkdirSync(dirname(sqlitePath), { recursive: true });
    const BetterSqlite3 = require("better-sqlite3");
    this.db = new BetterSqlite3(sqlitePath);
    this.now = now ?? (() => Date.now());
    this.db.prepare(
      `CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key TEXT PRIMARY KEY,
        entry_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`
    ).run();
    this.db.prepare(
      "CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at)"
    ).run();
  }

  async get(cacheKey: string): Promise<CacheEntry<T> | undefined> {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-sqlite.get");
    const row = this.db
      .prepare("SELECT entry_json, expires_at FROM cache_entries WHERE cache_key = ?")
      .get(normalizedKey) as { entry_json: string; expires_at: number } | undefined;
    if (!row) return undefined;
    if (this.now() >= row.expires_at) {
      await this.delete(normalizedKey);
      return undefined;
    }
    const entry = JSON.parse(row.entry_json) as CacheEntry<T>;
    if (entry.cache_key !== normalizedKey) {
      return undefined;
    }
    return entry;
  }

  async set(entry: CacheEntry<T>): Promise<void> {
    const normalizedKey = assertH57CacheKey(entry.cache_key, "node-sqlite.set");
    this.db
      .prepare(
        `INSERT INTO cache_entries (cache_key, entry_json, expires_at, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           entry_json=excluded.entry_json,
           expires_at=excluded.expires_at,
           updated_at=excluded.updated_at`
      )
      .run(normalizedKey, JSON.stringify({ ...entry, cache_key: normalizedKey }), entry.metadata.expires_at, this.now());
  }

  async delete(cacheKey: string): Promise<void> {
    const normalizedKey = assertH57CacheKey(cacheKey, "node-sqlite.delete");
    this.db.prepare("DELETE FROM cache_entries WHERE cache_key = ?").run(normalizedKey);
  }

  async clear(): Promise<void> {
    this.db.prepare("DELETE FROM cache_entries").run();
  }

  async pruneExpired(nowMs?: number): Promise<number> {
    const threshold = nowMs ?? this.now();
    const info = this.db.prepare("DELETE FROM cache_entries WHERE expires_at <= ?").run(threshold) as {
      changes?: number;
    };
    return info.changes ?? 0;
  }

  async hydrateAllValid(limit?: number): Promise<CacheEntry<T>[]> {
    const max =
      typeof limit === "number" && Number.isInteger(limit) && limit > 0
        ? limit
        : Number.MAX_SAFE_INTEGER;
    const rows = this.db
      .prepare(
        "SELECT entry_json FROM cache_entries WHERE expires_at > ? ORDER BY updated_at DESC LIMIT ?"
      )
      .all(this.now(), max) as Array<{ entry_json: string }>;
    return rows.map((row) => JSON.parse(row.entry_json) as CacheEntry<T>);
  }
}
