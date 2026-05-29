#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${LCP_CROSS_GO_JS_ARTIFACT_DIR:-$ROOT_DIR/.artifacts/cross-go-javascript-onebyone-$(date +%Y%m%d-%H%M%S)}"
SKIP_JS_BUILD="${LCP_CROSS_GO_JS_SKIP_BUILD:-0}"

mkdir -p "$ARTIFACT_DIR"

REPORT_JSON="$ARTIFACT_DIR/report.json"
REPORT_MD="$ARTIFACT_DIR/report.md"
RUN_LOG="$ARTIFACT_DIR/run.log"

GO_CASES=(
  "TestPersistentStoreContractSetGetValue"
  "TestPersistentStoreContractOverwrite"
  "TestPersistentStoreContractDelete"
  "TestPersistentStoreContractClear"
  "TestPersistentStoreContractPruneExpired"
  "TestPersistentStoreContractHydrateAllValidAndLimit"
)

JS_CASES=(
  "set/get value after set"
  "overwrite existing key"
  "delete removes entry"
  "clear removes all entries"
  "pruneExpired removes expired only"
  "hydrateAllValid excludes expired and respects limit"
)

echo "[1/5] Preparing artifact dir: $ARTIFACT_DIR" | tee "$RUN_LOG"

if [[ "$SKIP_JS_BUILD" != "1" ]]; then
  echo "[2/5] Building JavaScript SDK dist artifacts" | tee -a "$RUN_LOG"
  npm --prefix "$ROOT_DIR/sdks/javascript" run build | tee -a "$RUN_LOG"
else
  echo "[2/5] Skipping JavaScript build (LCP_CROSS_GO_JS_SKIP_BUILD=1)" | tee -a "$RUN_LOG"
fi

echo "[3/5] Running Go one-by-one cases (memory + sqlite in each case)" | tee -a "$RUN_LOG"

declare -a GO_STATUS=()
declare -a JS_STATUS=()
declare -a MISMATCH_FLAGS=()

for i in "${!GO_CASES[@]}"; do
  go_case="${GO_CASES[$i]}"
  echo "- Go case: $go_case" | tee -a "$RUN_LOG"
  if (cd "$ROOT_DIR/sdks/go" && go test -run "$go_case" -v) >>"$RUN_LOG" 2>&1; then
    GO_STATUS[$i]="PASS"
  else
    GO_STATUS[$i]="FAIL"
  fi
done

echo "[4/5] Running JavaScript one-by-one IndexedDB cases" | tee -a "$RUN_LOG"

for i in "${!JS_CASES[@]}"; do
  js_case="${JS_CASES[$i]}"
  echo "- JS case: $js_case" | tee -a "$RUN_LOG"
  if (cd "$ROOT_DIR/sdks/javascript" && npx playwright test -c playwright.config.ts tests/browser/sdk.idb.contract.onebyone.spec.ts -g "$js_case") >>"$RUN_LOG" 2>&1; then
    JS_STATUS[$i]="PASS"
  else
    JS_STATUS[$i]="FAIL"
  fi

done

echo "[5/5] Comparing per-case outcomes and writing report" | tee -a "$RUN_LOG"

mismatch_count=0
fail_count=0

for i in "${!GO_CASES[@]}"; do
  if [[ "${GO_STATUS[$i]}" != "PASS" || "${JS_STATUS[$i]}" != "PASS" ]]; then
    fail_count=$((fail_count + 1))
  fi

  if [[ "${GO_STATUS[$i]}" != "${JS_STATUS[$i]}" ]]; then
    MISMATCH_FLAGS[$i]="YES"
    mismatch_count=$((mismatch_count + 1))
  else
    MISMATCH_FLAGS[$i]="NO"
  fi
done

status="MATCHED"
if [[ "$mismatch_count" -gt 0 || "$fail_count" -gt 0 ]]; then
  status="MISMATCH"
fi

export LCP_GO_STATUS="$(printf '%s\n' "${GO_STATUS[@]}" | node -e 'const fs=require("fs");const data=fs.readFileSync(0,"utf8").trim().split(/\n/).filter(Boolean);process.stdout.write(JSON.stringify(data));')"
export LCP_JS_STATUS="$(printf '%s\n' "${JS_STATUS[@]}" | node -e 'const fs=require("fs");const data=fs.readFileSync(0,"utf8").trim().split(/\n/).filter(Boolean);process.stdout.write(JSON.stringify(data));')"
export LCP_MISMATCH_FLAGS="$(printf '%s\n' "${MISMATCH_FLAGS[@]}" | node -e 'const fs=require("fs");const data=fs.readFileSync(0,"utf8").trim().split(/\n/).filter(Boolean);process.stdout.write(JSON.stringify(data));')"

# Write report with populated case arrays.
node - "$REPORT_JSON" "$REPORT_MD" "$status" "$mismatch_count" "$fail_count" <<'NODE'
const fs = require('fs');

const reportJsonPath = process.argv[2];
const reportMdPath = process.argv[3];
const status = process.argv[4];
const mismatchCount = Number.parseInt(process.argv[5], 10);
const failCount = Number.parseInt(process.argv[6], 10);

const goCases = [
  'TestPersistentStoreContractSetGetValue',
  'TestPersistentStoreContractOverwrite',
  'TestPersistentStoreContractDelete',
  'TestPersistentStoreContractClear',
  'TestPersistentStoreContractPruneExpired',
  'TestPersistentStoreContractHydrateAllValidAndLimit'
];

const jsCases = [
  'set/get value after set',
  'overwrite existing key',
  'delete removes entry',
  'clear removes all entries',
  'pruneExpired removes expired only',
  'hydrateAllValid excludes expired and respects limit'
];

const goStatus = process.env.LCP_GO_STATUS ? JSON.parse(process.env.LCP_GO_STATUS) : [];
const jsStatus = process.env.LCP_JS_STATUS ? JSON.parse(process.env.LCP_JS_STATUS) : [];
const mismatchFlags = process.env.LCP_MISMATCH_FLAGS ? JSON.parse(process.env.LCP_MISMATCH_FLAGS) : [];

const cases = goCases.map((goCase, idx) => ({
  index: idx + 1,
  go_case: goCase,
  js_case: jsCases[idx],
  go_status: goStatus[idx] ?? 'UNKNOWN',
  js_status: jsStatus[idx] ?? 'UNKNOWN',
  mismatch: mismatchFlags[idx] ?? 'UNKNOWN'
}));

const report = {
  status,
  mismatch_count: mismatchCount,
  fail_count: failCount,
  baseline: 'javascript',
  cases
};

fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const lines = [
  '# Cross One-by-One Comparison (Go vs JavaScript)',
  '',
  `- Baseline: JavaScript`,
  `- Status: ${status}`,
  `- Mismatch count: ${mismatchCount}`,
  `- Fail count: ${failCount}`,
  '',
  '| # | Go case | JS case | Go | JS | Mismatch |',
  '|---|---|---|---|---|---|'
];

for (const row of cases) {
  lines.push(`| ${row.index} | ${row.go_case} | ${row.js_case} | ${row.go_status} | ${row.js_status} | ${row.mismatch} |`);
}

lines.push('');
fs.writeFileSync(reportMdPath, lines.join('\n'), 'utf8');
NODE

echo "Artifacts: $ARTIFACT_DIR"
echo "Report: $REPORT_MD"
echo "Log: $RUN_LOG"

if [[ "$status" != "MATCHED" ]]; then
  echo "Cross one-by-one comparison failed (status=$status)." >&2
  exit 1
fi
