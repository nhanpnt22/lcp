<?php

declare(strict_types=1);

namespace Lcp\Php\Storage;

use Lcp\Php\Entry\CacheEntry;

/**
 * Mirrors the persistent-store contract shared by the Go
 * (PersistentCacheStore[T]), NodeJS (NodePersistentStore<T>), and
 * Flutter (PersistentCacheStore<T>) SDKs.
 */
interface PersistentStoreInterface
{
    public function get(string $cacheKey): ?CacheEntry;

    public function set(CacheEntry $entry): void;

    public function delete(string $cacheKey): void;

    public function clear(): void;

    public function pruneExpired(?int $nowMs = null): int;

    /** @return CacheEntry[] */
    public function hydrateAllValid(?int $limit = null): array;
}
