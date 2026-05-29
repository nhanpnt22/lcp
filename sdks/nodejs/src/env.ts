import { join } from "node:path";
import {
  CloudStoragePersistentStore
} from "./stores/cloud.storage.persistent.store.js";
import { NodeMemoryPersistentStore } from "./stores/memory.persistent.store.js";
import { SQLitePersistentStore } from "./stores/sqlite.persistent.store.js";
import type { NodePersistentConfig, NodePersistentStore } from "./types.js";

function envOr(key: string, fallback: string): string {
  const value = (process.env[key] || "").trim();
  return value || fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const value = (process.env[key] || "").trim();
  if (!value) return fallback;
  return value.toLowerCase() === "true";
}

function envInt(key: string, fallback: number): number {
  const value = (process.env[key] || "").trim();
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCachePath(pathValue: string): string {
  const trimmed = pathValue.replace(/^\/+|\/+$/g, "").trim();
  return trimmed || "lcp";
}

function deriveCloudStorageUri(bucketUri: string, cachePath: string): string {
  const cleaned = bucketUri.replace(/\/+$/g, "");
  return `${cleaned}/${cachePath}`;
}

export function loadNodePersistentConfigFromEnv(): NodePersistentConfig {
  const cachePath = normalizeCachePath(envOr("LCP_CACHE_PATH", "lcp"));
  const localCacheRoot = envOr("LCP_LOCAL_CACHE_ROOT", "./config");
  const defaultSqlitePath = join(localCacheRoot, cachePath, "lcp_cache.db");

  const bucketUri = envOr("LCP_STORAGE_BUCKET_URI", "");
  const gcsUri = envOr("LCP_STORAGE_GCS_URI", bucketUri ? deriveCloudStorageUri(bucketUri, cachePath) : "");

  const runtimeMode = envOr("LCP_RUNTIME_MODE", "local") as "local" | "cloud-run";
  const localBackend = envOr("LCP_LOCAL_BACKEND", "in-memory") as "in-memory" | "sqlite" | "cloud-storage";
  const cloudRunInMemoryBackend = envOr("LCP_IN_MEMORY_BACKEND", "in-memory") as "in-memory";
  const cloudRunStorageBackend = envOr("LCP_STORAGE_BACKEND", "sqlite") as "sqlite" | "cloud-storage";
  const cloudRunBackendPreference = envOr("LCP_CLOUD_RUN_BACKEND_PREFERENCE", "in-memory") as "in-memory" | "storage";

  let backend: "in-memory" | "sqlite" | "cloud-storage";
  if (runtimeMode === "local") {
    backend = localBackend;
  } else {
    backend = cloudRunBackendPreference === "in-memory" ? cloudRunInMemoryBackend : cloudRunStorageBackend;
  }

  if (!envBool("LCP_PERSISTENT_ENABLED", true)) {
    backend = "in-memory";
  }

  if (backend === "cloud-storage" && !gcsUri) {
    throw new Error("LCP_STORAGE_GCS_URI (or LCP_STORAGE_BUCKET_URI) is required for cloud-storage backend");
  }

  return {
    enabled: envBool("LCP_PERSISTENT_ENABLED", true),
    runtimeMode,
    backend,
    cloudRunInMemoryBackend,
    cloudRunStorageBackend,
    cloudRunBackendPreference,
    sqlitePath: envOr("LCP_SQLITE_PATH", defaultSqlitePath),
    cloudStorageUri: gcsUri,
    googleCloudProject: envOr("GOOGLE_CLOUD_PROJECT", ""),
    cloudStorageUseUserProject: envBool("LCP_STORAGE_GCS_USE_USER_PROJECT", false),
    gcpServiceAccountKey: envOr("GCP_SA_KEY", envOr("GOOGLE_APPLICATION_CREDENTIALS", "")),
    persistenceMode: envOr("LCP_PERSISTENCE_MODE", "dual") as "auto" | "memory-only" | "dual",
    shortThresholdMs: envInt("LCP_PERSISTENCE_SHORT_THRESHOLD_MS", 300000)
  };
}

export function createNodePersistentStoreFromEnv<T>(): {
  store: NodePersistentStore<T> | undefined;
  config: NodePersistentConfig;
} {
  const config = loadNodePersistentConfigFromEnv();
  if (!config.enabled) {
    return { store: undefined, config };
  }

  if (config.backend === "in-memory") {
    return { store: new NodeMemoryPersistentStore<T>(), config };
  }
  if (config.backend === "sqlite") {
    return { store: new SQLitePersistentStore<T>(config.sqlitePath), config };
  }

  return {
    store: new CloudStoragePersistentStore<T>({
      cloudStorageUri: config.cloudStorageUri,
      credentialsFile: config.gcpServiceAccountKey,
      projectId: config.googleCloudProject,
      enableUserProject: config.cloudStorageUseUserProject
    }),
    config
  };
}
