<?php

declare(strict_types=1);

namespace Lcp\Php\Entry;

/**
 * Wire shape aligned with sdks/go/cache_entry.go CacheMetadata and the
 * JavaScript/Flutter equivalents (snake_case JSON keys on the wire).
 */
final class CacheMetadata implements \JsonSerializable
{
    public function __construct(
        public readonly CacheSource $source,
        public readonly int $createdAt,
        public readonly int $expiresAt,
        public readonly int $ttlMs,
        public readonly string $schemaVersion,
        public readonly string $dataVersion,
        public readonly string $specChecksum,
        public readonly string $cacheNamespace,
        public readonly bool $compressed,
    ) {
    }

    public static function create(
        CacheSource $source,
        int $createdAt,
        int $ttlMs,
        string $schemaVersion,
        string $dataVersion,
        string $specChecksum,
        string $cacheNamespace,
        bool $compressed,
    ): self {
        return new self(
            $source,
            $createdAt,
            $createdAt + $ttlMs,
            $ttlMs,
            $schemaVersion,
            $dataVersion,
            $specChecksum,
            $cacheNamespace,
            $compressed,
        );
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        foreach (['source', 'created_at', 'expires_at', 'ttl_ms', 'schema_version', 'data_version', 'spec_checksum', 'cache_namespace', 'compressed'] as $key) {
            if (!array_key_exists($key, $data)) {
                throw new \InvalidArgumentException("cache metadata missing field: {$key}");
            }
        }

        return new self(
            CacheSource::from((string) $data['source']),
            (int) $data['created_at'],
            (int) $data['expires_at'],
            (int) $data['ttl_ms'],
            (string) $data['schema_version'],
            (string) $data['data_version'],
            (string) $data['spec_checksum'],
            (string) $data['cache_namespace'],
            (bool) $data['compressed'],
        );
    }

    /** @return array<string, mixed> */
    public function jsonSerialize(): array
    {
        return [
            'source' => $this->source->value,
            'created_at' => $this->createdAt,
            'expires_at' => $this->expiresAt,
            'ttl_ms' => $this->ttlMs,
            'schema_version' => $this->schemaVersion,
            'data_version' => $this->dataVersion,
            'spec_checksum' => $this->specChecksum,
            'cache_namespace' => $this->cacheNamespace,
            'compressed' => $this->compressed,
        ];
    }
}
