package lcp

import (
	"fmt"
	"strings"
)

type CloudRunPersistentMode string

const (
	CloudRunPersistentModeInMemory CloudRunPersistentMode = "in-memory"
	CloudRunPersistentModeSQLite   CloudRunPersistentMode = "sqlite"
	CloudRunPersistentModeCloud    CloudRunPersistentMode = "cloud-storage"
)

type CloudRunPersistentStoreOptions struct {
	SQLitePath        string
	CloudStorageURI   string
	CredentialsFile   string
	ProjectID         string
	EnableUserProject bool
}

// NewCloudRunPersistentStore returns a PersistentCacheStore configured for Cloud Run.
// - in-memory: process-local persistent map
// - sqlite: SQLite-backed persistent store
// - cloud-storage: direct Cloud Storage API backed persistent store
func NewCloudRunPersistentStore[T any](mode CloudRunPersistentMode, opts CloudRunPersistentStoreOptions) (PersistentCacheStore[T], error) {
	switch mode {
	case CloudRunPersistentModeInMemory:
		return NewInMemoryPersistentStore[T](), nil
	case CloudRunPersistentModeSQLite:
		if strings.TrimSpace(opts.SQLitePath) == "" {
			return nil, fmt.Errorf("SQLitePath is required for sqlite mode")
		}
		return NewSQLitePersistentStore[T](opts.SQLitePath)
	case CloudRunPersistentModeCloud:
		if strings.TrimSpace(opts.CloudStorageURI) == "" {
			return nil, fmt.Errorf("CloudStorageURI is required for cloud-storage mode")
		}
		return NewCloudStoragePersistentStoreFromURI[T](opts.CloudStorageURI, CloudStoragePersistentStoreOptions{
			CredentialsFile:   strings.TrimSpace(opts.CredentialsFile),
			ProjectID:         strings.TrimSpace(opts.ProjectID),
			EnableUserProject: opts.EnableUserProject,
		})
	default:
		return nil, fmt.Errorf("unsupported Cloud Run persistent mode: %s", mode)
	}
}
