import { computeCacheKey, h57HashFn, createCacheMetadata } from "../../javascript/dist/index.js";
import { CloudStoragePersistentStore } from "../dist/src/stores/cloud.storage.persistent.store.js";

const N = Number(process.env.BENCH_N || 500);
const BUCKET = process.env.BENCH_BUCKET || "lcp-bench-bucket";

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

const keys = Array.from({ length: N }, (_, i) => h57Key(`key-${i}`));
const entries = keys.map((key, i) => makeEntry(key, i));

const store = new CloudStoragePersistentStore({
  cloudStorageUri: `gs://${BUCKET}/bench`,
  projectId: "lcp-bench"
});

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
  `cloud-storage: write ${entries.length} entries in ${writeMs.toFixed(1)}ms ` +
    `(${(writeMs / entries.length).toFixed(4)}ms/op), ` +
    `read ${keys.length} entries in ${readMs.toFixed(1)}ms ` +
    `(${(readMs / keys.length).toFixed(4)}ms/op)`
);

await store.clear();
