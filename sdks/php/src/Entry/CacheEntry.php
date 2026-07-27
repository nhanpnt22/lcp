<?php

declare(strict_types=1);

namespace Lcp\Php\Entry;

final class CacheEntry implements \JsonSerializable
{
    public function __construct(
        public readonly string $cacheKey,
        public readonly mixed $data,
        public readonly CacheMetadata $metadata,
    ) {
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        if (!isset($data['cache_key']) || !is_string($data['cache_key'])) {
            throw new \InvalidArgumentException('cache entry missing cache_key');
        }
        if (!isset($data['metadata']) || !is_array($data['metadata'])) {
            throw new \InvalidArgumentException('cache entry missing metadata');
        }

        return new self(
            $data['cache_key'],
            $data['data'] ?? null,
            CacheMetadata::fromArray($data['metadata']),
        );
    }

    public function withCacheKey(string $cacheKey): self
    {
        return new self($cacheKey, $this->data, $this->metadata);
    }

    /** @return array<string, mixed> */
    public function jsonSerialize(): array
    {
        return [
            'cache_key' => $this->cacheKey,
            'data' => $this->data,
            'metadata' => $this->metadata,
        ];
    }
}
