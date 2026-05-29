import { describe, expect, it } from "vitest";
import { CloudStoragePersistentStore } from "../src/stores/cloud.storage.persistent.store.js";

describe("node cloud storage persistent store validation", () => {
  it("rejects cloudStorageUri without gs scheme", () => {
    expect(() => new CloudStoragePersistentStore({ cloudStorageUri: "https://bucket/lcp" })).toThrow(
      /must start with gs:\/\//
    );
  });

  it("rejects cloudStorageUri without bucket", () => {
    expect(() => new CloudStoragePersistentStore({ cloudStorageUri: "gs:///lcp" })).toThrow(/bucket is required/);
  });

  it("rejects enableUserProject without projectId", () => {
    expect(() =>
      new CloudStoragePersistentStore({ cloudStorageUri: "gs://bucket/lcp", enableUserProject: true })
    ).toThrow(/projectId is required/);
  });
});
