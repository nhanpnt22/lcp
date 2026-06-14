package lcp

import (
	"errors"
	"fmt"
	"strings"
)

func (c EnvironmentPersistentStoreConfig) validate() error {
	if !c.Enabled {
		return nil
	}
	if !isAllowedPersistenceMode(c.PersistenceMode) {
		return fmt.Errorf("unsupported LCP_PERSISTENCE_MODE: %s", c.PersistenceMode)
	}

	switch c.RuntimeMode {
	case LCPRuntimeModeLocal:
		return c.validateLocalBackend()
	case LCPRuntimeModeCloudRun:
		return c.validateCloudRunConfig()
	default:
		return fmt.Errorf("unsupported runtime mode: %s", c.RuntimeMode)
	}
}

func (c EnvironmentPersistentStoreConfig) validateLocalBackend() error {
	switch c.Backend {
	case LCPPersistentBackendInMemory, LCPPersistentBackendSQLite, LCPPersistentBackendFile:
		return nil
	case LCPPersistentBackendCloudStorage:
		return c.validateCloudStorageTarget()
	default:
		return fmt.Errorf("unsupported local backend: %s", c.Backend)
	}
}

func (c EnvironmentPersistentStoreConfig) validateCloudRunConfig() error {
	if !isAllowedCloudRunInMemoryBackend(c.CloudRunInMemoryBackend) {
		return fmt.Errorf("unsupported cloud-run in-memory backend: %s", c.CloudRunInMemoryBackend)
	}
	if !isAllowedCloudRunStorageBackend(c.CloudRunStorageBackend) {
		return fmt.Errorf("unsupported cloud-run storage backend: %s", c.CloudRunStorageBackend)
	}
	if c.CloudRunBackendPreference != LCPCloudRunBackendPreferenceInMemory && c.CloudRunBackendPreference != LCPCloudRunBackendPreferenceStorage {
		return fmt.Errorf("unsupported LCP_CLOUD_RUN_BACKEND_PREFERENCE: %s", c.CloudRunBackendPreference)
	}

	switch c.Backend {
	case LCPPersistentBackendInMemory:
		return nil
	case LCPPersistentBackendCloudStorage:
		return c.validateCloudStorageTarget()
	case LCPPersistentBackendSQLite:
		return validateNonEmpty(c.SQLitePath, "LCP_SQLITE_PATH is required for sqlite backend")
	default:
		return fmt.Errorf("unsupported cloud-run backend: %s", c.Backend)
	}
}

func (c EnvironmentPersistentStoreConfig) validateCloudStorageTarget() error {
	if strings.TrimSpace(c.CloudStorageURI) == "" {
		return fmt.Errorf("LCP_STORAGE_GCS_URI (or LCP_STORAGE_BUCKET_URI) is required for cloud-storage backend")
	}
	if !strings.HasPrefix(strings.TrimSpace(c.CloudStorageURI), "gs://") {
		return fmt.Errorf("LCP_STORAGE_GCS_URI must start with gs://")
	}
	_, _, err := parseGCSURI(c.CloudStorageURI)
	if err != nil {
		return err
	}
	return nil
}

func validateNonEmpty(value, errMessage string) error {
	if strings.TrimSpace(value) == "" {
		return errors.New(errMessage)
	}
	return nil
}

func (c EnvironmentPersistentStoreConfig) resolveCloudRunBackend() (LCPPersistentBackend, error) {
	switch c.CloudRunBackendPreference {
	case LCPCloudRunBackendPreferenceInMemory:
		if c.CloudRunInMemoryBackend == LCPPersistentBackendInMemory {
			return c.CloudRunInMemoryBackend, nil
		}
		return "", fmt.Errorf("unsupported cloud-run in-memory backend: %s", c.CloudRunInMemoryBackend)
	case LCPCloudRunBackendPreferenceStorage:
		if c.CloudRunStorageBackend == LCPPersistentBackendSQLite || c.CloudRunStorageBackend == LCPPersistentBackendCloudStorage {
			return c.CloudRunStorageBackend, nil
		}
		return "", fmt.Errorf("unsupported cloud-run storage backend: %s", c.CloudRunStorageBackend)
	default:
		return "", fmt.Errorf("unsupported LCP_CLOUD_RUN_BACKEND_PREFERENCE: %s", c.CloudRunBackendPreference)
	}
}

func isAllowedCloudRunInMemoryBackend(value LCPPersistentBackend) bool {
	return value == LCPPersistentBackendInMemory
}

func isAllowedCloudRunStorageBackend(value LCPPersistentBackend) bool {
	return value == LCPPersistentBackendSQLite || value == LCPPersistentBackendCloudStorage
}

func isAllowedPersistenceMode(value CachePersistenceMode) bool {
	return value == CachePersistenceAuto || value == CachePersistenceMemoryOnly || value == CachePersistenceDual
}
