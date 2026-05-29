# Cross One-by-One Comparison (Go vs JavaScript)

- Baseline: JavaScript
- Status: MATCHED
- Mismatch count: 0
- Fail count: 0

| # | Go case | JS case | Go | JS | Mismatch |
|---|---|---|---|---|---|
| 1 | TestPersistentStoreContractSetGetValue | set/get value after set | PASS | PASS | NO |
| 2 | TestPersistentStoreContractOverwrite | overwrite existing key | PASS | PASS | NO |
| 3 | TestPersistentStoreContractDelete | delete removes entry | PASS | PASS | NO |
| 4 | TestPersistentStoreContractClear | clear removes all entries | PASS | PASS | NO |
| 5 | TestPersistentStoreContractPruneExpired | pruneExpired removes expired only | PASS | PASS | NO |
| 6 | TestPersistentStoreContractHydrateAllValidAndLimit | hydrateAllValid excludes expired and respects limit | PASS | PASS | NO |
