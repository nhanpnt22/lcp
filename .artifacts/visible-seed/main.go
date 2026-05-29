package main

import (
  "fmt"
  lcp "github.com/nhanpnt22/lcp/sdks/go"
)

func main() {
  key, err := lcp.ComputeCacheKey(lcp.CacheKeyInput{
    Namespace: "manual",
    OperationID: "visible",
    Payload: map[string]any{"suite": "manual-visible", "label": "visible"},
    SchemaVersion: "v1",
    SpecChecksum: "spec-v1",
    UserScope: "test-user",
  }, lcp.H57HashFn)
  if err != nil { panic(err) }

  store, err := lcp.NewCloudStoragePersistentStoreFromURI[map[string]any](
    "gs://aiptesting.firebasestorage.app/lcp/manual-visible",
    lcp.CloudStoragePersistentStoreOptions{
      CredentialsFile: "/Users/brian/dev/aco/aip/sdp/lcp/sdks/go/config/testing/aiptesting-firebase-adminsdk-fbsvc-398b4932fd.json",
      ProjectID: "aiptesting",
    },
  )
  if err != nil { panic(err) }

  entry := lcp.CacheEntry[map[string]any]{
    CacheKey: key,
    Data: map[string]any{"value": "alpha"},
    Metadata: lcp.CreateCacheMetadata(lcp.CacheSourceAPI, 1000, 86400000, "v1", "v1", "spec-v1", "ns:v1", false),
  }
  if err := store.Set(entry); err != nil { panic(err) }
  fmt.Println("wrote:", key)
}
