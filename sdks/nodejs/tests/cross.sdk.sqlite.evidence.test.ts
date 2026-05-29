import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { describe, it } from "vitest";
import { createCacheMetadata, type CacheEntry } from "../../javascript/entry/cache.entry.js";
import { computeCacheKey, h57HashFn, type CacheKeyInput } from "../../javascript/key/cache.key.js";
import { SQLitePersistentStore } from "../src/stores/sqlite.persistent.store.js";

type CrossDataset = {
  namespace: string;
  operation_id: string;
  payload: Record<string, unknown>;
  schema_version: string;
  spec_checksum: string;
  user_scope: string;
  value: string;
};

type CrossEvidenceRecord = {
  dataset_index: number;
  cache_key: string;
  value: string;
  db_cache_key: string;
  db_value: string;
  h57_match: boolean;
};

type CrossEvidence = {
  sdk: "nodejs";
  db_path: string;
  records: CrossEvidenceRecord[];
  row_count: number;
};

type NodeDbRow = {
  cache_key: string;
  entry_json: string;
};

describe("cross sdk sqlite evidence", () => {
  it("writes deterministic sqlite evidence for shared dataset", async ({ skip }) => {
    const datasetsPath = process.env.LCP_CROSS_DATASETS_FILE?.trim() || "";
    const dbPath = process.env.LCP_CROSS_NODE_SQLITE_DB?.trim() || "";
    const evidencePath = process.env.LCP_CROSS_NODE_EVIDENCE_FILE?.trim() || "";

    if (!datasetsPath || !dbPath || !evidencePath) {
      skip();
      return;
    }

    const raw = readFileSync(datasetsPath, "utf8");
    const datasets = JSON.parse(raw) as CrossDataset[];

    mkdirSync(dirname(dbPath), { recursive: true });
    rmSync(dbPath, { force: true });

    const now = 1700000000000;
    const store = new SQLitePersistentStore<{ value: string }>(dbPath, () => now);

    const records: CrossEvidenceRecord[] = [];
    for (let i = 0; i < datasets.length; i += 1) {
      const ds = datasets[i];
      const keyInput: CacheKeyInput = {
        namespace: ds.namespace,
        operationId: ds.operation_id,
        payload: ds.payload,
        schemaVersion: ds.schema_version,
        specChecksum: ds.spec_checksum,
        userScope: ds.user_scope
      };
      const cacheKey = computeCacheKey(keyInput, h57HashFn);
      const entry: CacheEntry<{ value: string }> = {
        cache_key: cacheKey,
        data: { value: ds.value },
        metadata: createCacheMetadata({
          source: "API",
          createdAt: now,
          ttlMs: 60000,
          schemaVersion: ds.schema_version,
          dataVersion: "dv-1",
          specChecksum: ds.spec_checksum,
          cacheNamespace: ds.namespace,
          compressed: false
        })
      };
      await store.set(entry);

      const recomputed = computeCacheKey(keyInput, h57HashFn);
      records.push({
        dataset_index: i,
        cache_key: cacheKey,
        value: ds.value,
        db_cache_key: "",
        db_value: "",
        h57_match: recomputed === cacheKey
      });
    }

    const BetterSqlite3 = (await import("better-sqlite3")).default;
    const db = new BetterSqlite3(dbPath, { readonly: true });
    const rows = db
      .prepare("SELECT cache_key, entry_json FROM cache_entries ORDER BY cache_key")
      .all() as NodeDbRow[];
    db.close();

    const rowByKey = new Map<string, NodeDbRow>();
    for (const row of rows) {
      rowByKey.set(row.cache_key, row);
    }

    for (const record of records) {
      const row = rowByKey.get(record.cache_key);
      if (!row) {
        throw new Error(`missing sqlite row for cache_key ${record.cache_key}`);
      }
      const parsed = JSON.parse(row.entry_json) as CacheEntry<{ value: string }>;
      record.db_cache_key = row.cache_key;
      record.db_value = parsed.data.value;
      if (record.db_value !== record.value) {
        throw new Error(`value mismatch for dataset ${record.dataset_index}`);
      }
    }

    const out: CrossEvidence = {
      sdk: "nodejs",
      db_path: dbPath,
      records,
      row_count: rows.length
    };

    mkdirSync(dirname(evidencePath), { recursive: true });
    writeFileSync(evidencePath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  });
});
