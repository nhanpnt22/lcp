package lcp

type CacheSource string

const (
	CacheSourceAPI   CacheSource = "API"
	CacheSourceCache CacheSource = "CACHE"
)

type CacheMetadata struct {
	Source         CacheSource `json:"source"`
	CreatedAt      int64       `json:"created_at"`
	ExpiresAt      int64       `json:"expires_at"`
	TTLMS          int64       `json:"ttl_ms"`
	SchemaVersion  string      `json:"schema_version"`
	DataVersion    string      `json:"data_version"`
	SpecChecksum   string      `json:"spec_checksum"`
	CacheNamespace string      `json:"cache_namespace"`
	Compressed     bool        `json:"compressed"`
}

func CreateCacheMetadata(source CacheSource, createdAt, ttlMS int64, schemaVersion, dataVersion, specChecksum, cacheNamespace string, compressed bool) CacheMetadata {
	return CacheMetadata{
		Source:         source,
		CreatedAt:      createdAt,
		ExpiresAt:      createdAt + ttlMS,
		TTLMS:          ttlMS,
		SchemaVersion:  schemaVersion,
		DataVersion:    dataVersion,
		SpecChecksum:   specChecksum,
		CacheNamespace: cacheNamespace,
		Compressed:     compressed,
	}
}

type CacheEntry[T any] struct {
	CacheKey string        `json:"cache_key"`
	Data     T             `json:"data"`
	Metadata CacheMetadata `json:"metadata"`
}

type CacheMetadataParityExpectation struct {
	SchemaVersion  string
	SpecChecksum   string
	CacheNamespace string
}

func IsCacheMetadataParityValid(metadata CacheMetadata, expected CacheMetadataParityExpectation) bool {
	if metadata.SchemaVersion != expected.SchemaVersion {
		return false
	}
	if metadata.SpecChecksum != expected.SpecChecksum {
		return false
	}
	if metadata.CacheNamespace != expected.CacheNamespace {
		return false
	}
	if metadata.CreatedAt < 0 || metadata.ExpiresAt < 0 || metadata.TTLMS < 0 {
		return false
	}
	if metadata.ExpiresAt != metadata.CreatedAt+metadata.TTLMS {
		return false
	}
	if metadata.DataVersion == "" {
		return false
	}
	return true
}
