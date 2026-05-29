import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type Dataset = {
  namespace: string;
  operation_id: string;
  payload: Record<string, unknown>;
  schema_version: string;
  spec_checksum: string;
  user_scope: string;
  value: string;
};

type EvidenceRecord = {
  dataset_index: number;
  cache_key: string;
  value: string;
  db_cache_key: string;
  db_value: string;
  h57_match: boolean;
};

type Evidence = {
  sdk: string;
  db_path: string;
  records: EvidenceRecord[];
  row_count: number;
};

type DatasetSchema = {
  items?: {
    required?: string[];
    additionalProperties?: boolean;
    properties?: Record<string, { type?: string }>;
  };
};

function assertRequiredKeys(row: Record<string, unknown>, required: Set<string>): void {
  for (const key of required) {
    expect(row[key]).not.toBeUndefined();
  }
}

function assertNoUnknownKeys(row: Record<string, unknown>, props: Record<string, { type?: string }>): void {
  for (const key of Object.keys(row)) {
    expect(Object.hasOwn(props, key)).toBe(true);
  }
}

function assertPropertyTypes(row: Record<string, unknown>, props: Record<string, { type?: string }>): void {
  for (const [key, descriptor] of Object.entries(props)) {
    const value = row[key];
    if (value === undefined) {
      continue;
    }
    if (descriptor.type === "string") {
      expect(typeof value).toBe("string");
      continue;
    }
    if (descriptor.type === "object") {
      expect(typeof value).toBe("object");
      expect(value).not.toBeNull();
    }
  }
}

function generateDatasets(count: number): Dataset[] {
  const out: Dataset[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      namespace: `ns:${i % 7}`,
      operation_id: `op:${i % 11}`,
      payload: {
        id: i,
        tags: [`tag-${i % 3}`, `group-${i % 5}`],
        metrics: {
          score: i * 13,
          ratio: Number(((i + 1) / (i + 2)).toFixed(6))
        },
        // Trace fields must be ignored by deterministic key material.
        trace_id: `trace-${i}`,
        request_id: `request-${i}`,
        action_id: `action-${i}`,
        nested: {
          safe: true,
          request_id: `nested-request-${i}`,
          map: {
            k: `v-${i}`,
            n: i
          }
        }
      },
      schema_version: "schema-v1",
      spec_checksum: "spec-v1",
      user_scope: `tenant:${i % 9}`,
      value: `value-${i.toString().padStart(3, "0")}`
    });
  }
  return out;
}

function loadEvidence(path: string): Evidence {
  return JSON.parse(readFileSync(path, "utf8")) as Evidence;
}

function assertDatasetsMatchSchema(datasets: Dataset[], schemaPath: string): void {
  const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as DatasetSchema;
  const required = new Set(schema.items?.required ?? []);
  const props = schema.items?.properties ?? {};
  const strictProps = schema.items?.additionalProperties === false;

  for (const dataset of datasets) {
    const row = dataset as Record<string, unknown>;
    assertRequiredKeys(row, required);
    if (strictProps) {
      assertNoUnknownKeys(row, props);
    }
    assertPropertyTypes(row, props);
  }
}

function assertEvidenceShape(evidence: Evidence, sdk: string, datasetCount: number): void {
  expect(evidence.sdk).toBe(sdk);
  expect(evidence.row_count).toBe(datasetCount);
  expect(evidence.records).toHaveLength(datasetCount);
  for (const record of evidence.records) {
    expect(record.h57_match).toBe(true);
    expect(record.cache_key.length).toBeGreaterThan(0);
    expect(record.value).toBe(record.db_value);
    expect(record.cache_key).toBe(record.db_cache_key);
  }
}

function withToolPath(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const basePath = env.PATH ?? "";
  const extra = ["/usr/local/go/bin", "/opt/homebrew/bin"];
  const merged = [basePath, ...extra].filter((value) => value.length > 0).join(":");
  return {
    ...env,
    PATH: merged
  };
}

test.describe("cross-sdk parity", () => {
  test("matches Go SQLite, Flutter SQLite, and JavaScript IndexedDB for 100 datasets", async ({ page }) => {
    await page.goto("/");

    const specDir = dirname(fileURLToPath(import.meta.url));
    const javascriptRoot = resolve(specDir, "../..");
    const repoRoot = resolve(javascriptRoot, "../..");
    const goRoot = resolve(repoRoot, "sdks/go");
    const flutterRoot = resolve(repoRoot, "sdks/flutter");
    const schemaPath = resolve(repoRoot, "specs/cross_sdk_dataset.schema.json");

    const runId = `${Date.now()}`;
    const artifactDir = resolve(javascriptRoot, "test-results", `cross-sdk-${runId}`);
    mkdirSync(artifactDir, { recursive: true });

    const failFirst = process.env.LCP_CROSS_FAIL_FIRST === "1";
    const datasetCountRaw = Number.parseInt(process.env.LCP_CROSS_DATASET_COUNT ?? "100", 10);
    const datasetCount = Number.isFinite(datasetCountRaw) && datasetCountRaw > 0 ? datasetCountRaw : 100;
    const datasets = generateDatasets(datasetCount);
    assertDatasetsMatchSchema(datasets, schemaPath);
    const datasetsPath = resolve(artifactDir, "datasets.json");
    const goDbPath = resolve(artifactDir, "go-cross.db");
    const flutterDbPath = resolve(artifactDir, "flutter-cross.db");
    const goEvidencePath = resolve(artifactDir, "go-evidence.json");
    const flutterEvidencePath = resolve(artifactDir, "flutter-evidence.json");
    const jsEvidencePath = resolve(artifactDir, "javascript-evidence.json");

    writeFileSync(datasetsPath, JSON.stringify(datasets, null, 2));

    execFileSync("go", ["test", "-run", "TestCrossSdkSqliteEvidence", "-count=1", "./"], {
      cwd: goRoot,
      env: withToolPath({
        ...process.env,
        LCP_CROSS_DATASETS_FILE: datasetsPath,
        LCP_CROSS_DATASET_COUNT: String(datasetCount),
        LCP_CROSS_GO_SQLITE_DB: goDbPath,
        LCP_CROSS_GO_EVIDENCE_FILE: goEvidencePath
      }),
      stdio: "pipe"
    });

    execFileSync("flutter", ["test", "test/cross_sdk_sqlite_evidence_test.dart", "-r", "expanded"], {
      cwd: flutterRoot,
      env: withToolPath({
        ...process.env,
        LCP_CROSS_DATASETS_FILE: datasetsPath,
        LCP_CROSS_DATASET_COUNT: String(datasetCount),
        LCP_CROSS_FLUTTER_SQLITE_DB: flutterDbPath,
        LCP_CROSS_FLUTTER_EVIDENCE_FILE: flutterEvidencePath
      }),
      stdio: "pipe"
    });

    const jsEvidence = await page.evaluate(
      async ({ datasetsFromNode, dbName, failFirstFromNode }) => {
        const sdkUrl = new URL("/dist/index.js", globalThis.location.origin).href;
        const sdk = await import(sdkUrl);

        await new Promise<void>((resolveDelete) => {
          const req = indexedDB.deleteDatabase(dbName);
          req.onsuccess = () => resolveDelete();
          req.onerror = () => resolveDelete();
          req.onblocked = () => resolveDelete();
        });

        const now = () => 1700000000000;
        const store = new sdk.IndexedDbCacheStore({ dbName, now });

        const records: Array<{
          dataset_index: number;
          cache_key: string;
          value: string;
          h57_match: boolean;
        }> = [];

        for (let i = 0; i < datasetsFromNode.length; i++) {
          const ds = datasetsFromNode[i];

          const keyInput = {
            namespace: ds.namespace,
            operationId: ds.operation_id,
            payload: ds.payload,
            schemaVersion: ds.schema_version,
            specChecksum: ds.spec_checksum,
            userScope: ds.user_scope
          };

          const cacheKey = sdk.computeCacheKey(keyInput, sdk.h57HashFn);

          const valueToStore = failFirstFromNode && i === 0 ? `${ds.value}-fail-first` : ds.value;

          await store.set({
            cache_key: cacheKey,
            data: { value: valueToStore },
            metadata: sdk.createCacheMetadata({
              source: "API",
              createdAt: 1700000000000,
              ttlMs: 60000,
              schemaVersion: ds.schema_version,
              dataVersion: "dv-1",
              specChecksum: ds.spec_checksum,
              cacheNamespace: ds.namespace,
              compressed: false
            })
          });

          const recomputed = sdk.computeCacheKey(keyInput, sdk.h57HashFn);
          records.push({
            dataset_index: i,
            cache_key: cacheKey,
            value: ds.value,
            h57_match: recomputed === cacheKey
          });
        }

        const dbRows = await new Promise<Array<{ cache_key: string; entry_json: string }>>((resolveRows, rejectRows) => {
          const openReq = indexedDB.open(dbName);
          openReq.onerror = () => rejectRows(new Error("open indexeddb failed"));
          openReq.onsuccess = () => {
            const db = openReq.result;
            const tx = db.transaction("cache_entries", "readonly");
            const storeObj = tx.objectStore("cache_entries");
            const rows: Array<{ cache_key: string; entry_json: string }> = [];
            const cursorReq = storeObj.openCursor();
            cursorReq.onerror = () => rejectRows(new Error("cursor read failed"));
            cursorReq.onsuccess = () => {
              const cursor = cursorReq.result;
              if (!cursor) {
                resolveRows(rows);
                return;
              }
              rows.push(cursor.value as { cache_key: string; entry_json: string });
              cursor.continue();
            };
          };
        });

        const dbByKey = new Map<string, { cache_key: string; entry_json: string }>();
        for (const row of dbRows) {
          dbByKey.set(row.cache_key, row);
        }

        const complete = records
          .map((record) => {
            const row = dbByKey.get(record.cache_key);
            if (!row) {
              throw new Error(`missing indexeddb row for cache_key ${record.cache_key}`);
            }
            const parsed = JSON.parse(row.entry_json) as {
              cache_key: string;
              data: { value: string };
            };
            return {
              dataset_index: record.dataset_index,
              cache_key: record.cache_key,
              value: record.value,
              db_cache_key: parsed.cache_key,
              db_value: parsed.data.value,
              h57_match: record.h57_match
            };
          })
          .sort((a, b) => a.dataset_index - b.dataset_index);

        return {
          sdk: "javascript",
          db_path: `indexeddb:${dbName}`,
          records: complete,
          row_count: dbRows.length
        };
      },
      {
        datasetsFromNode: datasets,
        dbName: `lcp-cross-parity-${runId}`,
        failFirstFromNode: failFirst
      }
    );

    writeFileSync(jsEvidencePath, JSON.stringify(jsEvidence, null, 2));

    const goEvidence = loadEvidence(goEvidencePath);
    const flutterEvidence = loadEvidence(flutterEvidencePath);

    assertEvidenceShape(goEvidence, "go", datasetCount);
    assertEvidenceShape(flutterEvidence, "flutter", datasetCount);
    assertEvidenceShape(jsEvidence, "javascript", datasetCount);

    for (let i = 0; i < datasetCount; i++) {
      const goRecord = goEvidence.records[i];
      const flutterRecord = flutterEvidence.records[i];
      const jsRecord = jsEvidence.records[i];

      expect(goRecord.dataset_index).toBe(i);
      expect(flutterRecord.dataset_index).toBe(i);
      expect(jsRecord.dataset_index).toBe(i);

      expect(goRecord.cache_key).toBe(flutterRecord.cache_key);
      expect(goRecord.cache_key).toBe(jsRecord.cache_key);

      expect(goRecord.value).toBe(flutterRecord.value);
      expect(goRecord.value).toBe(jsRecord.value);
    }
  });
});
