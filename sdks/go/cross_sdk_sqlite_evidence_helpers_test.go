package lcp

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"testing"
)

type crossDataset struct {
	Namespace     string         `json:"namespace"`
	OperationID   string         `json:"operation_id"`
	Payload       map[string]any `json:"payload"`
	SchemaVersion string         `json:"schema_version"`
	SpecChecksum  string         `json:"spec_checksum"`
	UserScope     string         `json:"user_scope"`
	Value         string         `json:"value"`
}

type crossEvidenceRecord struct {
	DatasetIndex int    `json:"dataset_index"`
	CacheKey     string `json:"cache_key"`
	Value        string `json:"value"`
	DBCacheKey   string `json:"db_cache_key"`
	DBValue      string `json:"db_value"`
	H57Match     bool   `json:"h57_match"`
}

type crossEvidence struct {
	SDK      string                `json:"sdk"`
	DBPath   string                `json:"db_path"`
	Records  []crossEvidenceRecord `json:"records"`
	RowCount int                   `json:"row_count"`
}

type goPersistedEntry struct {
	CacheKey string `json:"cache_key"`
	Data     struct {
		Value string `json:"value"`
	} `json:"data"`
}

type crossEnv struct {
	DatasetsPath string
	DBPath       string
	EvidencePath string
}

func readCrossEnv() (crossEnv, bool) {
	env := crossEnv{
		DatasetsPath: os.Getenv("LCP_CROSS_DATASETS_FILE"),
		DBPath:       os.Getenv("LCP_CROSS_GO_SQLITE_DB"),
		EvidencePath: os.Getenv("LCP_CROSS_GO_EVIDENCE_FILE"),
	}
	return env, env.DatasetsPath != "" && env.DBPath != "" && env.EvidencePath != ""
}

func mustLoadCrossDatasets(t *testing.T, datasetsPath string) []crossDataset {
	t.Helper()

	rawDatasets, err := os.ReadFile(datasetsPath)
	if err != nil {
		t.Fatalf("read datasets file: %v", err)
	}

	var datasets []crossDataset
	if err := json.Unmarshal(rawDatasets, &datasets); err != nil {
		t.Fatalf("decode datasets: %v", err)
	}
	expectedCount := crossDatasetCount()
	if len(datasets) != expectedCount {
		t.Fatalf("expected %d datasets, got %d", expectedCount, len(datasets))
	}
	return datasets
}

func crossDatasetCount() int {
	raw := os.Getenv("LCP_CROSS_DATASET_COUNT")
	if raw == "" {
		return 100
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value <= 0 {
		return 100
	}
	return value
}

func prepareDBPath(t *testing.T, dbPath string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o755); err != nil {
		t.Fatalf("mkdir sqlite dir: %v", err)
	}
	_ = os.Remove(dbPath)
}

func persistDatasetsAndBuildRecords(t *testing.T, datasets []crossDataset, dbPath string) []crossEvidenceRecord {
	t.Helper()
	store, err := NewSQLitePersistentStore[map[string]any](dbPath)
	if err != nil {
		t.Fatalf("create sqlite store: %v", err)
	}
	defer func() { _ = store.Close() }()

	records := make([]crossEvidenceRecord, 0, len(datasets))
	for idx, ds := range datasets {
		cacheKey, err := ComputeCacheKey(CacheKeyInput{
			Namespace:     ds.Namespace,
			OperationID:   ds.OperationID,
			Payload:       ds.Payload,
			SchemaVersion: ds.SchemaVersion,
			SpecChecksum:  ds.SpecChecksum,
			UserScope:     ds.UserScope,
		}, H57HashFn)
		if err != nil {
			t.Fatalf("compute cache key for dataset %d: %v", idx, err)
		}

		entry := CacheEntry[map[string]any]{
			CacheKey: cacheKey,
			Data:     map[string]any{"value": ds.Value},
			Metadata: CreateCacheMetadata(
				CacheSourceAPI,
				1700000000000,
				60000,
				ds.SchemaVersion,
				"dv-1",
				ds.SpecChecksum,
				ds.Namespace,
				false,
			),
		}
		if err := store.Set(entry); err != nil {
			t.Fatalf("store set dataset %d: %v", idx, err)
		}

		recomputed, err := cacheKeyForDataset(ds)
		if err != nil {
			t.Fatalf("recompute cache key for dataset %d: %v", idx, err)
		}

		records = append(records, crossEvidenceRecord{
			DatasetIndex: idx,
			CacheKey:     cacheKey,
			Value:        ds.Value,
			H57Match:     recomputed == cacheKey,
		})
	}
	sort.Slice(records, func(i, j int) bool {
		return records[i].DatasetIndex < records[j].DatasetIndex
	})
	return records
}

func mustReadAndValidateRows(t *testing.T, dbPath string, expectedRows int) []goPersistedEntry {
	t.Helper()
	dbRows, err := readGoSQLiteRows(dbPath)
	if err != nil {
		t.Fatalf("read sqlite evidence rows: %v", err)
	}
	if len(dbRows) != expectedRows {
		t.Fatalf("expected %d sqlite rows, got %d", expectedRows, len(dbRows))
	}
	return dbRows
}

func attachRowsToRecords(t *testing.T, records []crossEvidenceRecord, dbRows []goPersistedEntry) {
	t.Helper()
	rowByKey := make(map[string]goPersistedEntry, len(dbRows))
	for _, row := range dbRows {
		rowByKey[row.CacheKey] = row
	}

	for i := range records {
		row, ok := rowByKey[records[i].CacheKey]
		if !ok {
			t.Fatalf("missing sqlite row for cache_key %s", records[i].CacheKey)
		}
		records[i].DBCacheKey = row.CacheKey
		records[i].DBValue = row.Data.Value
		if records[i].DBValue != records[i].Value {
			t.Fatalf("value mismatch for dataset %d", records[i].DatasetIndex)
		}
	}
}

func cacheKeyForDataset(ds crossDataset) (string, error) {
	return ComputeCacheKey(CacheKeyInput{
		Namespace:     ds.Namespace,
		OperationID:   ds.OperationID,
		Payload:       ds.Payload,
		SchemaVersion: ds.SchemaVersion,
		SpecChecksum:  ds.SpecChecksum,
		UserScope:     ds.UserScope,
	}, H57HashFn)
}
