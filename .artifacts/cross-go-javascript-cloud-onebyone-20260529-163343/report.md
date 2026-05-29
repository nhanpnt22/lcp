# Cross One-by-One Comparison (Go memory+cloud-storage vs JavaScript IndexedDB)

- Baseline: JavaScript
- Status: MISMATCH
- Mismatch count: 3
- Fail count: 3

| # | Go case | JS case | Go | JS | Mismatch |
|---|---|---|---|---|---|
| 1 | TestPersistentStoreCloudContractSetGetValue | set/get value after set | PASS | PASS | NO |
| 2 | TestPersistentStoreCloudContractOverwrite | overwrite existing key | PASS | PASS | NO |
| 3 | TestPersistentStoreCloudContractDelete | delete removes entry | FAIL | PASS | YES |
| 4 | TestPersistentStoreCloudContractClear | clear removes all entries | FAIL | PASS | YES |
| 5 | TestPersistentStoreCloudContractPruneExpired | pruneExpired removes expired only | FAIL | PASS | YES |
| 6 | TestPersistentStoreCloudContractHydrateAllValidAndLimit | hydrateAllValid excludes expired and respects limit | PASS | PASS | NO |
