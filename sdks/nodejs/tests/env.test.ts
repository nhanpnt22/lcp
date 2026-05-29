import { describe, expect, it } from "vitest";
import { loadNodePersistentConfigFromEnv } from "../src/env.js";

describe("nodejs env config", () => {
  it("selects local sqlite backend", () => {
    const sqlitePath = "./config/testing/test-cache.db";
    process.env.LCP_PERSISTENT_ENABLED = "true";
    process.env.LCP_RUNTIME_MODE = "local";
    process.env.LCP_LOCAL_BACKEND = "sqlite";
    process.env.LCP_SQLITE_PATH = sqlitePath;

    const cfg = loadNodePersistentConfigFromEnv();
    expect(cfg.backend).toBe("sqlite");
    expect(cfg.sqlitePath).toBe(sqlitePath);
  });

  it("selects cloud-run storage cloud-storage backend", () => {
    process.env.LCP_PERSISTENT_ENABLED = "true";
    process.env.LCP_RUNTIME_MODE = "cloud-run";
    process.env.LCP_CLOUD_RUN_BACKEND_PREFERENCE = "storage";
    process.env.LCP_STORAGE_BACKEND = "cloud-storage";
    process.env.LCP_STORAGE_GCS_URI = "gs://bucket/lcp";

    const cfg = loadNodePersistentConfigFromEnv();
    expect(cfg.backend).toBe("cloud-storage");
    expect(cfg.cloudStorageUri).toBe("gs://bucket/lcp");
  });

  it("defaults cloud storage user project opt-in to false", () => {
    process.env.LCP_PERSISTENT_ENABLED = "true";
    process.env.LCP_RUNTIME_MODE = "local";
    process.env.LCP_LOCAL_BACKEND = "cloud-storage";
    process.env.LCP_STORAGE_GCS_URI = "gs://bucket/lcp";
    process.env.LCP_STORAGE_GCS_USE_USER_PROJECT = "";

    const cfg = loadNodePersistentConfigFromEnv();
    expect(cfg.cloudStorageUseUserProject).toBe(false);
  });

  it("enables cloud storage user project when env is true", () => {
    process.env.LCP_PERSISTENT_ENABLED = "true";
    process.env.LCP_RUNTIME_MODE = "local";
    process.env.LCP_LOCAL_BACKEND = "cloud-storage";
    process.env.LCP_STORAGE_GCS_URI = "gs://bucket/lcp";
    process.env.LCP_STORAGE_GCS_USE_USER_PROJECT = "true";

    const cfg = loadNodePersistentConfigFromEnv();
    expect(cfg.cloudStorageUseUserProject).toBe(true);
  });
});
