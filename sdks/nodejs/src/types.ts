import type { CacheEntry } from "@sdp/lcp-javascript-sdk";

export type NodeRuntimeMode = "local" | "cloud-run";
export type NodePersistentBackend = "in-memory" | "sqlite" | "cloud-storage";
export type NodeCloudRunBackendPreference = "in-memory" | "storage";

export interface NodePersistentStore<T = unknown> {
  get(cacheKey: string): Promise<CacheEntry<T> | undefined>;
  set(entry: CacheEntry<T>): Promise<void>;
  delete(cacheKey: string): Promise<void>;
  clear(): Promise<void>;
  pruneExpired(nowMs?: number): Promise<number>;
  hydrateAllValid(limit?: number): Promise<CacheEntry<T>[]>;
}

export interface NodePersistentConfig {
  enabled: boolean;
  runtimeMode: NodeRuntimeMode;
  backend: NodePersistentBackend;
  cloudRunInMemoryBackend: "in-memory";
  cloudRunStorageBackend: "sqlite" | "cloud-storage";
  cloudRunBackendPreference: NodeCloudRunBackendPreference;
  sqlitePath: string;
  cloudStorageUri: string;
  googleCloudProject: string;
  cloudStorageUseUserProject: boolean;
  gcpServiceAccountKey: string;
  persistenceMode: "auto" | "memory-only" | "dual";
  shortThresholdMs: number;
}
