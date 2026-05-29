# Cross One-by-One Comparison (Go memory+cloud-storage vs JavaScript IndexedDB)

- Baseline: JavaScript
- Status: MATCHED
- Mismatch count: 0
- Fail count: 0

| # | Go case | JS case | Go | JS | Mismatch |
|---|---|---|---|---|---|
| 1 | TestPersistentStoreCloudContractSetGetValue | set/get value after set | PASS | PASS | NO |
| 2 | TestPersistentStoreCloudContractOverwrite | overwrite existing key | PASS | PASS | NO |
| 3 | TestPersistentStoreCloudContractDelete | delete removes entry | PASS | PASS | NO |
| 4 | TestPersistentStoreCloudContractClear | clear removes all entries | PASS | PASS | NO |
| 5 | TestPersistentStoreCloudContractPruneExpired | pruneExpired removes expired only | PASS | PASS | NO |
| 6 | TestPersistentStoreCloudContractHydrateAllValidAndLimit | hydrateAllValid excludes expired and respects limit | PASS | PASS | NO |
