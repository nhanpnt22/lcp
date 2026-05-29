import {
  MemoryCacheStore,
  createNodePersistentStoreFromEnv,
  createNodeReadThroughCacheEngine,
  h57HashFn,
  type ReadThroughRequest
} from "../src/index.js";

type UserProfile = {
  id: string;
  name: string;
  plan: string;
};

const memoryStore = new MemoryCacheStore<UserProfile>({
  maxEntries: 2000,
  now: () => Date.now()
});

const { store, config } = createNodePersistentStoreFromEnv<UserProfile>();

const engine = createNodeReadThroughCacheEngine<UserProfile>({
  memoryStore,
  persistentStore: store,
  parity: {
    schemaVersion: "schema-v1",
    dataVersion: "dv-1",
    specChecksum: "spec-v1",
    cacheNamespace: "profile"
  },
  persistence: {
    mode: config.persistenceMode,
    shortThresholdMs: config.shortThresholdMs
  }
});

async function fetchProfileFromApi(userId: string): Promise<{ data: UserProfile; ttlMs: number }> {
  // Replace this stub with a real upstream call (fetch/axios/gRPC/etc).
  return {
    data: {
      id: userId,
      name: "demo-user",
      plan: "pro"
    },
    ttlMs: 60_000
  };
}

export async function getProfileCached(userId: string): Promise<{
  source: "API" | "CACHE";
  cacheKey: string;
  data: UserProfile;
  stale: boolean;
}> {
  const request: ReadThroughRequest<UserProfile> = {
    keyInput: {
      namespace: "profile",
      operationId: "user.profile.get",
      payload: { user_id: userId },
      schemaVersion: "schema-v1",
      specChecksum: "spec-v1",
      userScope: "tenant:default"
    },
    h57Hash: h57HashFn,
    fetchFromApi: () => fetchProfileFromApi(userId),
    allowStaleOnExpired: true
  };

  const result = await engine.execute(request);
  return {
    source: result.source,
    cacheKey: result.cacheKey,
    data: result.data,
    stale: result.stale
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const userId = process.argv[2] || "user-001";
  getProfileCached(userId)
    .then((result) => {
      console.log(JSON.stringify({
        runtime_mode: config.runtimeMode,
        backend: config.backend,
        persistence_mode: config.persistenceMode,
        result
      }, null, 2));
    })
    .catch((err) => {
      console.error("Example failed:", err);
      process.exitCode = 1;
    });
}
