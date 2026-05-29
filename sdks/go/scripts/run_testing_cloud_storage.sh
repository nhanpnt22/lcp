#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-config/testing/.env}"
BUCKET_URI="${BUCKET_URI:-}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud is required but not found"
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "$BUCKET_URI" ]]; then
  if [[ -n "${LCP_STORAGE_GCS_URI:-}" ]]; then
    BUCKET_URI="${LCP_STORAGE_GCS_URI%/}"
  elif [[ -n "${LCP_STORAGE_BUCKET_URI:-}" ]]; then
    BUCKET_URI="${LCP_STORAGE_BUCKET_URI%/}/${LCP_CACHE_PATH:-lcp}"
  else
    BUCKET_URI="gs://aiptesting.firebasestorage.app/lcp"
  fi
fi

if [[ -z "${GCP_SA_KEY:-}" ]]; then
  echo "GCP_SA_KEY is not set in env file"
  exit 1
fi

if [[ ! -f "$GCP_SA_KEY" ]]; then
  echo "Service account key file not found: $GCP_SA_KEY"
  exit 1
fi

PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-aiptesting}"

echo "Authenticating service account and setting project..."
gcloud auth activate-service-account --key-file="$GCP_SA_KEY" >/dev/null
gcloud config set project "$PROJECT_ID" >/dev/null

echo "Running Go tests with cloud-storage local backend profile..."
ENV=testing \
LCP_RUNTIME_MODE=local \
LCP_LOCAL_BACKEND=cloud-storage \
LCP_STORAGE_BACKEND=cloud-storage \
LCP_STORAGE_GCS_URI="$BUCKET_URI" \
go test ./...

echo "Seeding one cache entry via SDK..."
ENV=testing \
LCP_RUNTIME_MODE=local \
LCP_LOCAL_BACKEND=cloud-storage \
LCP_STORAGE_BACKEND=cloud-storage \
LCP_STORAGE_GCS_URI="$BUCKET_URI" \
go run ./cmd/seed_cache

echo "Listing remote objects under $BUCKET_URI"
gcloud storage ls "$BUCKET_URI"

echo "Done."
