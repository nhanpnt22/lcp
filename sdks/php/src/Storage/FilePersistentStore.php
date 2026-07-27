<?php

declare(strict_types=1);

namespace Lcp\Php\Storage;

use Lcp\Php\Entry\CacheEntry;
use Lcp\Php\Key\H57;

/**
 * Persists cache entries as JSON files under a root directory, one file per
 * entry named `<rootDir>/<H57 cache_key>.json` — the canonical H57 cache key
 * is used directly as the filename, with no additional hashing, matching the
 * Go (`FilePersistentStore`), NodeJS (`FilePersistentStore`), and Flutter
 * (`FilePersistentCacheStore`) implementations.
 *
 * Writes go to a temporary file and are committed with an atomic rename, so a
 * partially written entry is never observable. Works on local disks and on
 * Cloud Storage FUSE mount paths.
 *
 * Unlike {@see SQLitePersistentStore}, `hydrateAllValid()` returns entries
 * ordered by filename ascending (i.e. by cache key), matching the file-store
 * ordering in the other SDKs.
 */
final class FilePersistentStore implements PersistentStoreInterface
{
    private readonly string $rootDir;

    /** @var \Closure(): int */
    private \Closure $now;

    public function __construct(string $rootDir, ?\Closure $now = null)
    {
        $trimmed = trim($rootDir);
        if ($trimmed === '') {
            throw new \InvalidArgumentException('rootDir is required');
        }

        $this->rootDir = rtrim($trimmed, \DIRECTORY_SEPARATOR);
        $this->now = $now ?? static fn (): int => (int) round(microtime(true) * 1000);
    }

    public function get(string $cacheKey): ?CacheEntry
    {
        $normalizedKey = H57::assertH57CacheKey($cacheKey, 'php-file.get');

        $entry = $this->readEntryFile($this->filePath($normalizedKey));
        if ($entry === null || $entry->cacheKey !== $normalizedKey) {
            return null;
        }

        if (($this->now)() >= $entry->metadata->expiresAt) {
            $this->delete($normalizedKey);
            return null;
        }

        return $entry;
    }

    public function set(CacheEntry $entry): void
    {
        $normalizedKey = H57::assertH57CacheKey($entry->cacheKey, 'php-file.set');

        if (!is_dir($this->rootDir)) {
            if (!mkdir($this->rootDir, 0755, true) && !is_dir($this->rootDir)) {
                throw new \RuntimeException("failed to create cache root dir: {$this->rootDir}");
            }
        }

        $filePath = $this->filePath($normalizedKey);
        $tmpPath = $filePath . '.tmp';
        $payload = json_encode($entry->withCacheKey($normalizedKey), JSON_THROW_ON_ERROR);

        if (file_put_contents($tmpPath, $payload, LOCK_EX) === false) {
            throw new \RuntimeException("failed to write cache file: {$tmpPath}");
        }

        if (!rename($tmpPath, $filePath)) {
            @unlink($tmpPath);
            throw new \RuntimeException("failed to commit cache file: {$filePath}");
        }
    }

    public function delete(string $cacheKey): void
    {
        $normalizedKey = H57::assertH57CacheKey($cacheKey, 'php-file.delete');
        $filePath = $this->filePath($normalizedKey);
        if (is_file($filePath) && !@unlink($filePath) && is_file($filePath)) {
            throw new \RuntimeException("failed to delete cache file: {$filePath}");
        }
    }

    public function clear(): void
    {
        foreach ($this->entryFiles() as $filePath) {
            if (!@unlink($filePath) && is_file($filePath)) {
                throw new \RuntimeException("failed to remove cache file: {$filePath}");
            }
        }
    }

    public function pruneExpired(?int $nowMs = null): int
    {
        $threshold = $nowMs ?? ($this->now)();

        $removed = 0;
        foreach ($this->entryFiles() as $filePath) {
            $entry = $this->readEntryFile($filePath);
            if ($entry === null) {
                continue;
            }
            if ($threshold >= $entry->metadata->expiresAt) {
                if (@unlink($filePath) || !is_file($filePath)) {
                    $removed++;
                }
            }
        }

        return $removed;
    }

    public function hydrateAllValid(?int $limit = null): array
    {
        $max = ($limit !== null && $limit > 0) ? $limit : PHP_INT_MAX;
        $now = ($this->now)();

        $files = $this->entryFiles();
        sort($files, SORT_STRING);

        $out = [];
        foreach ($files as $filePath) {
            $entry = $this->readEntryFile($filePath);
            if ($entry === null) {
                continue;
            }
            if ($now < $entry->metadata->expiresAt) {
                $out[] = $entry;
            }
            if (count($out) >= $max) {
                break;
            }
        }

        return $out;
    }

    private function filePath(string $cacheKey): string
    {
        return $this->rootDir . \DIRECTORY_SEPARATOR . $cacheKey . '.json';
    }

    /** @return string[] */
    private function entryFiles(): array
    {
        if (!is_dir($this->rootDir)) {
            return [];
        }

        $matches = glob($this->rootDir . \DIRECTORY_SEPARATOR . '*.json');

        return $matches === false ? [] : array_values(array_filter($matches, 'is_file'));
    }

    private function readEntryFile(string $filePath): ?CacheEntry
    {
        if (!is_file($filePath)) {
            return null;
        }

        $raw = @file_get_contents($filePath);
        if ($raw === false) {
            return null;
        }

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }

        if (!is_array($decoded)) {
            return null;
        }

        try {
            return CacheEntry::fromArray($decoded);
        } catch (\InvalidArgumentException) {
            return null;
        }
    }
}
