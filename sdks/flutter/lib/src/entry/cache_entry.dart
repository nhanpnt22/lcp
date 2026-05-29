enum CacheSource { api, cache }

class CacheMetadata {
  CacheMetadata({
    required this.source,
    required this.createdAt,
    required this.expiresAt,
    required this.ttlMs,
    required this.schemaVersion,
    required this.dataVersion,
    required this.specChecksum,
    required this.cacheNamespace,
    required this.compressed,
  });

  final CacheSource source;
  final int createdAt;
  final int expiresAt;
  final int ttlMs;
  final String schemaVersion;
  final String dataVersion;
  final String specChecksum;
  final String cacheNamespace;
  final bool compressed;

  Map<String, Object> toJson() => {
        'source': source == CacheSource.api ? 'API' : 'CACHE',
        'created_at': createdAt,
        'expires_at': expiresAt,
        'ttl_ms': ttlMs,
        'schema_version': schemaVersion,
        'data_version': dataVersion,
        'spec_checksum': specChecksum,
        'cache_namespace': cacheNamespace,
        'compressed': compressed,
      };
}

class CacheEntry<T> {
  CacheEntry({
    required this.cacheKey,
    required this.data,
    required this.metadata,
  });

  final String cacheKey;
  final T data;
  final CacheMetadata metadata;
}

class CacheMetadataParityExpectation {
  const CacheMetadataParityExpectation({
    required this.schemaVersion,
    required this.specChecksum,
    required this.cacheNamespace,
  });

  final String schemaVersion;
  final String specChecksum;
  final String cacheNamespace;
}

bool isCacheMetadataParityValid(
  CacheMetadata metadata,
  CacheMetadataParityExpectation expected,
) {
  if (metadata.schemaVersion != expected.schemaVersion) return false;
  if (metadata.specChecksum != expected.specChecksum) return false;
  if (metadata.cacheNamespace != expected.cacheNamespace) return false;
  if (metadata.createdAt < 0 || metadata.expiresAt < 0 || metadata.ttlMs < 0) {
    return false;
  }
  if (metadata.expiresAt != metadata.createdAt + metadata.ttlMs) return false;
  if (metadata.dataVersion.isEmpty) return false;
  return true;
}

CacheMetadata createCacheMetadata({
  required CacheSource source,
  required int createdAt,
  required int ttlMs,
  required String schemaVersion,
  required String dataVersion,
  required String specChecksum,
  required String cacheNamespace,
  bool compressed = false,
}) {
  final expiresAt = createdAt + ttlMs;
  return CacheMetadata(
    source: source,
    createdAt: createdAt,
    expiresAt: expiresAt,
    ttlMs: ttlMs,
    schemaVersion: schemaVersion,
    dataVersion: dataVersion,
    specChecksum: specChecksum,
    cacheNamespace: cacheNamespace,
    compressed: compressed,
  );
}
