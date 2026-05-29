#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${LCP_CROSS_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/cross-go-flutter-javascript-sqlite-$(date +%Y%m%d-%H%M%S)}"
DATASET_COUNT="${LCP_CROSS_DATASET_COUNT:-100}"

mkdir -p "$ARTIFACT_DIR"

echo "[1/3] Running Playwright cross-sdk sqlite parity"
(
  cd "$ROOT_DIR/sdks/javascript"
  LCP_CROSS_DATASET_COUNT="$DATASET_COUNT" \
  npx playwright test -c playwright.config.ts tests/browser/cross.sdk.parity.spec.ts --project=chromium
)

echo "[2/3] Locating latest cross-sdk evidence directory"
LATEST_DIR="$(ls -1dt "$ROOT_DIR"/sdks/javascript/test-results/cross-sdk-* 2>/dev/null | head -n 1 || true)"
if [[ -z "$LATEST_DIR" ]]; then
  echo "Unable to locate cross-sdk evidence directory under sdks/javascript/test-results" >&2
  exit 1
fi

cp "$LATEST_DIR"/datasets.json "$ARTIFACT_DIR"/datasets.json
cp "$LATEST_DIR"/go-evidence.json "$ARTIFACT_DIR"/go-evidence.json
cp "$LATEST_DIR"/flutter-evidence.json "$ARTIFACT_DIR"/flutter-evidence.json
cp "$LATEST_DIR"/javascript-evidence.json "$ARTIFACT_DIR"/javascript-evidence.json

node - "$ARTIFACT_DIR" <<'NODE'
const fs = require('fs');
const path = require('path');

const artifactDir = process.argv[2];
const go = JSON.parse(fs.readFileSync(path.join(artifactDir, 'go-evidence.json'), 'utf8'));
const flutter = JSON.parse(fs.readFileSync(path.join(artifactDir, 'flutter-evidence.json'), 'utf8'));
const js = JSON.parse(fs.readFileSync(path.join(artifactDir, 'javascript-evidence.json'), 'utf8'));

const rowCount = go.row_count;
let mismatchCount = 0;

for (let i = 0; i < rowCount; i += 1) {
  const g = go.records[i];
  const f = flutter.records[i];
  const j = js.records[i];
  if (!g || !f || !j || g.cache_key !== f.cache_key || g.cache_key !== j.cache_key || g.value !== f.value || g.value !== j.value) {
    mismatchCount += 1;
  }
}

const summary = {
  dataset_count: rowCount,
  mismatch_count: mismatchCount,
  status: mismatchCount === 0 ? 'MATCHED' : 'MISMATCH'
};

fs.writeFileSync(path.join(artifactDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
NODE

echo "[3/3] Completed"
echo "Artifacts: $ARTIFACT_DIR"
echo "Evidence files:"
echo "- $ARTIFACT_DIR/datasets.json"
echo "- $ARTIFACT_DIR/go-evidence.json"
echo "- $ARTIFACT_DIR/flutter-evidence.json"
echo "- $ARTIFACT_DIR/javascript-evidence.json"
echo "- $ARTIFACT_DIR/summary.json"
