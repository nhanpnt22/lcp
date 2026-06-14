package lcp

import (
	"os"
	"strconv"
	"strings"
)

func resolveLocalBackend(localBackendOverride, localStorageBackendRaw string) LCPPersistentBackend {
	if localBackendOverride != "" {
		return LCPPersistentBackend(localBackendOverride)
	}

	storageBackend := LCPPersistentBackend(localStorageBackendRaw)
	if storageBackend == LCPPersistentBackendSQLite || storageBackend == LCPPersistentBackendCloudStorage || storageBackend == LCPPersistentBackendFile {
		return storageBackend
	}

	return LCPPersistentBackendInMemory
}

func normalizePersistentBackend(value LCPPersistentBackend) LCPPersistentBackend {
	return value
}

func envOr(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func envBool(key string, fallback bool) bool {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback
	}
	return parsed
}

func envInt64(key string, fallback int64) int64 {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	parsed, err := strconv.ParseInt(raw, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func normalizeCachePath(pathValue string) string {
	trimmed := strings.Trim(pathValue, " /")
	if trimmed == "" {
		return "lcp"
	}
	return trimmed
}
