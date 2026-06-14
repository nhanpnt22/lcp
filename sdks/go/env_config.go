package lcp

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type LCPRuntimeMode string

const (
	LCPRuntimeModeLocal    LCPRuntimeMode = "local"
	LCPRuntimeModeCloudRun LCPRuntimeMode = "cloud-run"
)

type LCPPersistentBackend string

const (
	LCPPersistentBackendInMemory     LCPPersistentBackend = "in-memory"
	LCPPersistentBackendSQLite       LCPPersistentBackend = "sqlite"
	LCPPersistentBackendCloudStorage LCPPersistentBackend = "cloud-storage"
	LCPPersistentBackendFile         LCPPersistentBackend = "file"
)

type LCPCloudRunBackendPreference string

const (
	LCPCloudRunBackendPreferenceInMemory LCPCloudRunBackendPreference = "in-memory"
	LCPCloudRunBackendPreferenceStorage  LCPCloudRunBackendPreference = "storage"
)

type EnvironmentPersistentStoreConfig struct {
	Enabled                    bool
	RuntimeMode                LCPRuntimeMode
	Backend                    LCPPersistentBackend
	PersistenceMode            CachePersistenceMode
	ShortThresholdMS           int64
	CloudRunInMemoryBackend    LCPPersistentBackend
	CloudRunStorageBackend     LCPPersistentBackend
	CloudRunBackendPreference  LCPCloudRunBackendPreference
	SQLitePath                 string
	FileCacheRoot              string
	CloudStorageURI            string
	GoogleCloudProject         string
	CloudStorageUseUserProject bool
	GCPServiceAccountKey       string
}

func LoadEnvironmentPersistentStoreConfig() (EnvironmentPersistentStoreConfig, error) {
	cachePath := normalizeCachePath(envOr("LCP_CACHE_PATH", "lcp"))
	localCacheRoot := strings.TrimSpace(envOr("LCP_LOCAL_CACHE_ROOT", "./config"))
	defaultSQLitePath := filepath.Join(localCacheRoot, cachePath, "lcp_cache.db")
	defaultFileCacheRoot := filepath.Join(localCacheRoot, cachePath, "files")

	bucketURI := strings.TrimSpace(envOr("LCP_STORAGE_BUCKET_URI", ""))
	storageURI := strings.TrimSpace(envOr("LCP_STORAGE_GCS_URI", ""))
	if storageURI == "" && bucketURI != "" {
		storageURI = strings.TrimRight(bucketURI, "/") + "/" + cachePath
	}

	cfg := EnvironmentPersistentStoreConfig{
		Enabled:                    envBool("LCP_PERSISTENT_ENABLED", true),
		RuntimeMode:                LCPRuntimeMode(strings.TrimSpace(envOr("LCP_RUNTIME_MODE", string(LCPRuntimeModeLocal)))),
		PersistenceMode:            CachePersistenceMode(strings.TrimSpace(envOr("LCP_PERSISTENCE_MODE", string(CachePersistenceDual)))),
		ShortThresholdMS:           envInt64("LCP_PERSISTENCE_SHORT_THRESHOLD_MS", 300000),
		GoogleCloudProject:         strings.TrimSpace(envOr("GOOGLE_CLOUD_PROJECT", "")),
		CloudStorageUseUserProject: envBool("LCP_STORAGE_GCS_USE_USER_PROJECT", false),
		GCPServiceAccountKey: strings.TrimSpace(
			envOr("GCP_SA_KEY", envOr("GOOGLE_APPLICATION_CREDENTIALS", "")),
		),
		SQLitePath:      strings.TrimSpace(envOr("LCP_SQLITE_PATH", defaultSQLitePath)),
		FileCacheRoot:   strings.TrimSpace(envOr("LCP_FILE_CACHE_ROOT", defaultFileCacheRoot)),
		CloudStorageURI: storageURI,
		CloudRunInMemoryBackend: LCPPersistentBackend(strings.TrimSpace(
			envOr("LCP_IN_MEMORY_BACKEND", envOr("LCP_CLOUD_RUN_IN_MEMORY_BACKEND", string(LCPPersistentBackendInMemory))),
		)),
		CloudRunStorageBackend: LCPPersistentBackend(strings.TrimSpace(
			envOr("LCP_STORAGE_BACKEND", envOr("LCP_CLOUD_RUN_STORAGE_BACKEND", string(LCPPersistentBackendSQLite))),
		)),
		CloudRunBackendPreference: LCPCloudRunBackendPreference(strings.TrimSpace(envOr("LCP_CLOUD_RUN_BACKEND_PREFERENCE", string(LCPCloudRunBackendPreferenceInMemory)))),
	}

	localBackendOverride := strings.TrimSpace(os.Getenv("LCP_LOCAL_BACKEND"))
	localStorageBackendRaw := strings.TrimSpace(os.Getenv("LCP_STORAGE_BACKEND"))

	cfg.CloudRunInMemoryBackend = normalizePersistentBackend(cfg.CloudRunInMemoryBackend)
	cfg.CloudRunStorageBackend = normalizePersistentBackend(cfg.CloudRunStorageBackend)
	localBackendOverride = string(normalizePersistentBackend(LCPPersistentBackend(localBackendOverride)))
	localStorageBackendRaw = string(normalizePersistentBackend(LCPPersistentBackend(localStorageBackendRaw)))

	if cfg.RuntimeMode == LCPRuntimeModeLocal {
		cfg.Backend = resolveLocalBackend(localBackendOverride, localStorageBackendRaw)
	} else if cfg.RuntimeMode == LCPRuntimeModeCloudRun {
		cloudBackend, err := cfg.resolveCloudRunBackend()
		if err != nil {
			return cfg, err
		}
		cfg.Backend = cloudBackend
	} else {
		return cfg, fmt.Errorf("unsupported LCP_RUNTIME_MODE: %s", cfg.RuntimeMode)
	}

	if err := cfg.validate(); err != nil {
		return cfg, err
	}
	return cfg, nil
}

func NewPersistentStoreFromEnv[T any]() (PersistentCacheStore[T], EnvironmentPersistentStoreConfig, error) {
	cfg, err := LoadEnvironmentPersistentStoreConfig()
	if err != nil {
		return nil, cfg, err
	}
	if !cfg.Enabled {
		return nil, cfg, nil
	}

	switch cfg.Backend {
	case LCPPersistentBackendInMemory:
		return NewInMemoryPersistentStore[T](), cfg, nil
	case LCPPersistentBackendSQLite:
		store, err := NewSQLitePersistentStore[T](cfg.SQLitePath)
		return store, cfg, err
	case LCPPersistentBackendFile:
		store, err := NewFilePersistentStore[T](cfg.FileCacheRoot)
		return store, cfg, err
	case LCPPersistentBackendCloudStorage:
		store, err := NewCloudStoragePersistentStoreFromURI[T](cfg.CloudStorageURI, CloudStoragePersistentStoreOptions{
			CredentialsFile:   cfg.GCPServiceAccountKey,
			ProjectID:         cfg.GoogleCloudProject,
			EnableUserProject: cfg.CloudStorageUseUserProject,
		})
		return store, cfg, err
	default:
		return nil, cfg, fmt.Errorf("unsupported persistent backend: %s", cfg.Backend)
	}
}
