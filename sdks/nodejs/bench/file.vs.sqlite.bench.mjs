import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { computeCacheKey, h57HashFn, createCacheMetadata } from "../../javascript/dist/index.js";
import { FilePersistentStore } from "../dist/src/stores/file.persistent.store.js";
import { SQLitePersistentStore } from "../dist/src/stores/sqlite.persistent.store.js";

const N = Number(process.env.BENCH_N || 10000);

function h57Key(label) {
  return computeCacheKey(
    {
      namespace: "bench",
      operationId: label,
      payload: { label },
      schemaVersion: "v1",
      specChecksum: "spec-v1",
      userScope: "bench-user"
    },
    h57HashFn
  );
}

function makeEntry(cacheKey, i) {
  return {
    cache_key: cacheKey,
    data: { value: `payload-${i}`, i },
    metadata: createCacheMetadata({
      source: "API",
      createdAt: 1000,
      ttlMs: 86_400_000,
      schemaVersion: "v1",
      dataVersion: "v1",
      specChecksum: "spec",
      cacheNamespace: "ns",
      compressed: false
    })
  };
}

async function bench(name, store, keys, entries) {
  const writeStart = performance.now();
  for (const entry of entries) {
    await store.set(entry);
  }
  const writeMs = performance.now() - writeStart;

  const readStart = performance.now();
  for (const key of keys) {
    await store.get(key);
  }
  const readMs = performance.now() - readStart;

  console.log(
    `${name}: write ${entries.length} entries in ${writeMs.toFixed(1)}ms ` +
      `(${(writeMs / entries.length).toFixed(4)}ms/op), ` +
      `read ${keys.length} entries in ${readMs.toFixed(1)}ms ` +
      `(${(readMs / keys.length).toFixed(4)}ms/op)`
  );
}

const keys = Array.from({ length: N }, (_, i) => h57Key(`key-${i}`));
const entries = keys.map((key, i) => makeEntry(key, i));

const fileDir = mkdtempSync(join(tmpdir(), "lcp-bench-file-"));
const sqliteDir = mkdtempSync(join(tmpdir(), "lcp-bench-sqlite-"));

try {
  const fileStore = new FilePersistentStore(fileDir);
  await bench("file  ", fileStore, keys, entries);

  const sqliteStore = new SQLitePersistentStore(join(sqliteDir, "bench.db"));
  await bench("sqlite", sqliteStore, keys, entries);
} finally {
  rmSync(fileDir, { recursive: true, force: true });
  rmSync(sqliteDir, { recursive: true, force: true });
}
