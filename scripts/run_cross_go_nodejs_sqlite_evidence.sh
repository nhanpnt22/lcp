#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATASET_COUNT="${LCP_CROSS_DATASET_COUNT:-120}"
ARTIFACT_DIR="${LCP_CROSS_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/cross-go-nodejs-evidence-$(date +%Y%m%d-%H%M%S)}"

mkdir -p "$ARTIFACT_DIR"

DATASETS_FILE="$ARTIFACT_DIR/datasets.json"
GO_DB_FILE="$ARTIFACT_DIR/go.sqlite.db"
NODE_DB_FILE="$ARTIFACT_DIR/node.sqlite.db"
GO_EVIDENCE_FILE="$ARTIFACT_DIR/go.evidence.json"
NODE_EVIDENCE_FILE="$ARTIFACT_DIR/node.evidence.json"
COMPARISON_JSON="$ARTIFACT_DIR/comparison.json"
COMPARISON_MD="$ARTIFACT_DIR/comparison.md"

echo "[1/5] Generating shared dataset ($DATASET_COUNT cases)"
node - "$DATASETS_FILE" "$DATASET_COUNT" <<'NODE'
const fs = require('fs');

const outputPath = process.argv[2];
const count = Number.parseInt(process.argv[3], 10);
const datasetCount = Number.isFinite(count) && count > 0 ? count : 120;
const out = [];

for (let i = 0; i < datasetCount; i += 1) {
  out.push({
    namespace: 'ns.profile.v1',
    operation_id: `get-user-${i % 7}`,
    payload: {
      userId: `u${i}`,
      includeMeta: i % 2 === 0,
      tags: [`t${i % 5}`, `g${i % 3}`],
      profile: { age: 20 + (i % 30), region: `r${i % 4}` }
    },
    schema_version: 'schema-v1',
    spec_checksum: 'spec-v1',
    user_scope: `scope-${i % 9}`,
    value: `value-${i}`
  });
}

fs.writeFileSync(outputPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
NODE

echo "[2/5] Running Go sqlite evidence test"
(
  cd "$ROOT_DIR/sdks/go"
  LCP_CROSS_DATASETS_FILE="$DATASETS_FILE" \
  LCP_CROSS_GO_SQLITE_DB="$GO_DB_FILE" \
  LCP_CROSS_GO_EVIDENCE_FILE="$GO_EVIDENCE_FILE" \
  LCP_CROSS_DATASET_COUNT="$DATASET_COUNT" \
  go test -run TestCrossSdkSqliteEvidence -v
)

echo "[3/5] Running NodeJS sqlite evidence test"
LCP_CROSS_DATASETS_FILE="$DATASETS_FILE" \
LCP_CROSS_NODE_SQLITE_DB="$NODE_DB_FILE" \
LCP_CROSS_NODE_EVIDENCE_FILE="$NODE_EVIDENCE_FILE" \
npm --prefix "$ROOT_DIR/sdks/nodejs" run test -- tests/cross.sdk.sqlite.evidence.test.ts

echo "[4/5] Comparing Go vs NodeJS evidence"
node - "$GO_EVIDENCE_FILE" "$NODE_EVIDENCE_FILE" "$COMPARISON_JSON" "$COMPARISON_MD" <<'NODE'
const fs = require('fs');

const goPath = process.argv[2];
const nodePath = process.argv[3];
const comparisonJsonPath = process.argv[4];
const comparisonMdPath = process.argv[5];

const goEvidence = JSON.parse(fs.readFileSync(goPath, 'utf8'));
const nodeEvidence = JSON.parse(fs.readFileSync(nodePath, 'utf8'));

const goMap = new Map(goEvidence.records.map((record) => [record.dataset_index, record]));
const nodeMap = new Map(nodeEvidence.records.map((record) => [record.dataset_index, record]));

const mismatches = [];
const maxCount = Math.max(goEvidence.records.length, nodeEvidence.records.length);

for (let i = 0; i < maxCount; i += 1) {
  const goRecord = goMap.get(i);
  const nodeRecord = nodeMap.get(i);

  if (!goRecord || !nodeRecord) {
    mismatches.push({
      dataset_index: i,
      kind: 'missing',
      go_present: Boolean(goRecord),
      node_present: Boolean(nodeRecord)
    });
    continue;
  }

  if (
    goRecord.cache_key !== nodeRecord.cache_key ||
    goRecord.value !== nodeRecord.value ||
    goRecord.db_value !== nodeRecord.db_value
  ) {
    mismatches.push({
      dataset_index: i,
      kind: 'value',
      go: {
        cache_key: goRecord.cache_key,
        value: goRecord.value,
        db_value: goRecord.db_value
      },
      node: {
        cache_key: nodeRecord.cache_key,
        value: nodeRecord.value,
        db_value: nodeRecord.db_value
      }
    });
  }
}

const summary = {
  dataset_count: maxCount,
  go_rows: goEvidence.row_count,
  node_rows: nodeEvidence.row_count,
  go_h57_all: goEvidence.records.every((record) => record.h57_match),
  node_h57_all: nodeEvidence.records.every((record) => record.h57_match),
  mismatch_count: mismatches.length,
  status: mismatches.length === 0 ? 'MATCHED' : 'MISMATCH'
};

fs.writeFileSync(comparisonJsonPath, `${JSON.stringify({ summary, mismatches }, null, 2)}\n`, 'utf8');

const markdown = [
  '# Cross Evidence Comparison (Go vs NodeJS)',
  '',
  `- Dataset count: ${summary.dataset_count}`,
  `- Go rows: ${summary.go_rows}`,
  `- Node rows: ${summary.node_rows}`,
  `- Go H57 all match: ${summary.go_h57_all}`,
  `- Node H57 all match: ${summary.node_h57_all}`,
  `- Mismatch count: ${summary.mismatch_count}`,
  `- Status: ${summary.status}`,
  ''
].join('\n');
fs.writeFileSync(comparisonMdPath, markdown, 'utf8');

if (summary.status !== 'MATCHED') {
  console.error(JSON.stringify(summary));
  process.exit(1);
}

console.log(JSON.stringify(summary));
NODE

echo "[5/5] Completed. Artifacts: $ARTIFACT_DIR"
