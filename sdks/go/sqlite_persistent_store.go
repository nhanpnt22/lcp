package lcp

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "modernc.org/sqlite"
)

type SQLitePersistentStore[T any] struct {
	db *sql.DB
}

func NewSQLitePersistentStore[T any](dbPath string) (*SQLitePersistentStore[T], error) {
	trimmed := strings.TrimSpace(dbPath)
	if trimmed == "" {
		return nil, errors.New("sqlite dbPath is required")
	}
	if err := os.MkdirAll(filepath.Dir(trimmed), 0o755); err != nil {
		return nil, fmt.Errorf("create sqlite parent dir: %w", err)
	}
	db, err := sql.Open("sqlite", trimmed)
	if err != nil {
		return nil, fmt.Errorf("open sqlite db: %w", err)
	}
	store := &SQLitePersistentStore[T]{db: db}
	if err := store.init(); err != nil {
		_ = db.Close()
		return nil, err
	}
	return store, nil
}

func (s *SQLitePersistentStore[T]) init() error {
	_, err := s.db.Exec(`
		CREATE TABLE IF NOT EXISTS lcp_cache_entries (
			cache_key TEXT PRIMARY KEY,
			entry_json BLOB NOT NULL
		)
	`)
	if err != nil {
		return fmt.Errorf("create sqlite schema: %w", err)
	}
	return nil
}

func (s *SQLitePersistentStore[T]) Close() error {
	if s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *SQLitePersistentStore[T]) Get(cacheKey string) (*CacheEntry[T], error) {
	normalizedKey, err := validateH57CacheKey(cacheKey, "sqlite.get")
	if err != nil {
		return nil, err
	}
	var raw []byte
	err = s.db.QueryRow(`SELECT entry_json FROM lcp_cache_entries WHERE cache_key = ?`, normalizedKey).Scan(&raw)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("sqlite get entry: %w", err)
	}
	var entry CacheEntry[T]
	if err := json.Unmarshal(raw, &entry); err != nil {
		return nil, fmt.Errorf("sqlite decode entry: %w", err)
	}
	if entry.CacheKey != normalizedKey {
		return nil, nil
	}
	return &entry, nil
}

func (s *SQLitePersistentStore[T]) Set(entry CacheEntry[T]) error {
	normalizedKey, err := validateH57CacheKey(entry.CacheKey, "sqlite.set")
	if err != nil {
		return err
	}
	entry.CacheKey = normalizedKey
	raw, err := json.Marshal(entry)
	if err != nil {
		return fmt.Errorf("sqlite encode entry: %w", err)
	}
	_, err = s.db.Exec(`
		INSERT INTO lcp_cache_entries (cache_key, entry_json)
		VALUES (?, ?)
		ON CONFLICT(cache_key) DO UPDATE SET entry_json=excluded.entry_json
	`, normalizedKey, raw)
	if err != nil {
		return fmt.Errorf("sqlite upsert entry: %w", err)
	}
	return nil
}

func (s *SQLitePersistentStore[T]) Delete(cacheKey string) error {
	normalizedKey, err := validateH57CacheKey(cacheKey, "sqlite.delete")
	if err != nil {
		return err
	}
	_, err = s.db.Exec(`DELETE FROM lcp_cache_entries WHERE cache_key = ?`, normalizedKey)
	if err != nil {
		return fmt.Errorf("sqlite delete entry: %w", err)
	}
	return nil
}

func (s *SQLitePersistentStore[T]) Clear() error {
	_, err := s.db.Exec(`DELETE FROM lcp_cache_entries`)
	if err != nil {
		return fmt.Errorf("sqlite clear entries: %w", err)
	}
	return nil
}

func (s *SQLitePersistentStore[T]) PruneExpired(now int64) (int, error) {
	entries, err := s.readAllEntries()
	if err != nil {
		return 0, err
	}
	removed := 0
	for _, entry := range entries {
		eval := EvaluateTTL(entry.Metadata.CreatedAt, now, entry.Metadata.TTLMS)
		if eval.Status != TtlStatusExpired {
			continue
		}
		if err := s.Delete(entry.CacheKey); err != nil {
			return removed, err
		}
		removed++
	}
	return removed, nil
}

func (s *SQLitePersistentStore[T]) HydrateAllValid(now int64, limit *int) ([]CacheEntry[T], error) {
	entries, err := s.readAllEntries()
	if err != nil {
		return nil, err
	}
	sort.Slice(entries, func(i, j int) bool { return entries[i].CacheKey < entries[j].CacheKey })
	out := make([]CacheEntry[T], 0, len(entries))
	for _, entry := range entries {
		eval := EvaluateTTL(entry.Metadata.CreatedAt, now, entry.Metadata.TTLMS)
		if eval.Status == TtlStatusExpired {
			continue
		}
		out = append(out, entry)
		if limit != nil && len(out) >= *limit {
			break
		}
	}
	return out, nil
}

func (s *SQLitePersistentStore[T]) readAllEntries() ([]CacheEntry[T], error) {
	rows, err := s.db.Query(`SELECT entry_json FROM lcp_cache_entries`)
	if err != nil {
		return nil, fmt.Errorf("sqlite query entries: %w", err)
	}
	defer rows.Close()

	out := make([]CacheEntry[T], 0)
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return nil, fmt.Errorf("sqlite scan entry: %w", err)
		}
		var entry CacheEntry[T]
		if err := json.Unmarshal(raw, &entry); err != nil {
			continue
		}
		out = append(out, entry)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("sqlite rows error: %w", err)
	}
	return out, nil
}
