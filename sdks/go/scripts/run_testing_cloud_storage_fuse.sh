#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Deprecated: use scripts/run_testing_cloud_storage.sh"
exec "$SCRIPT_DIR/run_testing_cloud_storage.sh" "$@"
