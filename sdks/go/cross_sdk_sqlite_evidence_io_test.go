package lcp

import (
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func mustWriteCrossEvidence(t *testing.T, evidencePath string, out crossEvidence) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(evidencePath), 0o755); err != nil {
		t.Fatalf("mkdir evidence dir: %v", err)
	}
	encoded, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		t.Fatalf("encode evidence: %v", err)
	}
	if err := os.WriteFile(evidencePath, encoded, 0o644); err != nil {
		t.Fatalf("write evidence: %v", err)
	}
}

func readGoSQLiteRows(dbPath string) ([]goPersistedEntry, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}
	defer func() { _ = db.Close() }()

	rows, err := db.Query(`SELECT entry_json FROM lcp_cache_entries ORDER BY cache_key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]goPersistedEntry, 0)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, err
		}
		var entry goPersistedEntry
		if err := json.Unmarshal(raw, &entry); err != nil {
			return nil, err
		}
		out = append(out, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
