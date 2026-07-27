<?php

declare(strict_types=1);

namespace Lcp\Php\Storage;

use Lcp\Php\Entry\CacheEntry;
use Lcp\Php\Key\H57;

/**
 * SQLite-backed persistent store, ported from the schema/behavior shared by
 * the NodeJS (sdks/nodejs/src/stores/sqlite.persistent.store.ts) and Flutter
 * (sdks/flutter/lib/src/storage/sqlite_persistent_cache_store.dart) SQLite
 * stores: `cache_key` primary key, `entry_json`/`expires_at`/`updated_at`
 * columns, an index on `expires_at` for prune/hydrate queries, lazy
 * expiry-on-read, and `hydrateAllValid` ordered by `updated_at DESC`.
 */
final class SQLitePersistentStore implements PersistentStoreInterface
{
    private \PDO $pdo;

    /** @var \Closure(): int */
    private \Closure $now;

    public function __construct(string $sqlitePath, ?\Closure $now = null)
    {
        $trimmed = trim($sqlitePath);
        if ($trimmed === '') {
            throw new \InvalidArgumentException('sqlitePath is required');
        }

        $dir = dirname($trimmed);
        if ($dir !== '' && $dir !== '.' && !is_dir($dir)) {
            if (!mkdir($dir, 0755, true) && !is_dir($dir)) {
                throw new \RuntimeException("failed to create sqlite directory: {$dir}");
            }
        }

        $this->pdo = new \PDO('sqlite:' . $trimmed);
        $this->pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $this->now = $now ?? static fn (): int => (int) round(microtime(true) * 1000);

        $this->pdo->exec(
            'CREATE TABLE IF NOT EXISTS cache_entries (
                cache_key TEXT PRIMARY KEY,
                entry_json TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )'
        );
        $this->pdo->exec(
            'CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at ON cache_entries(expires_at)'
        );
    }

    public function get(string $cacheKey): ?CacheEntry
    {
        $normalizedKey = H57::assertH57CacheKey($cacheKey, 'php-sqlite.get');

        $stmt = $this->pdo->prepare('SELECT entry_json, expires_at FROM cache_entries WHERE cache_key = ?');
        $stmt->execute([$normalizedKey]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if ($row === false) {
            return null;
        }

        if (($this->now)() >= (int) $row['expires_at']) {
            $this->delete($normalizedKey);
            return null;
        }

        $entry = $this->decodeEntry($row['entry_json']);
        if ($entry === null || $entry->cacheKey !== $normalizedKey) {
            return null;
        }

        return $entry;
    }

    public function set(CacheEntry $entry): void
    {
        $normalizedKey = H57::assertH57CacheKey($entry->cacheKey, 'php-sqlite.set');
        $normalizedEntry = $entry->withCacheKey($normalizedKey);

        $stmt = $this->pdo->prepare(
            'INSERT INTO cache_entries (cache_key, entry_json, expires_at, updated_at)
             VALUES (:cache_key, :entry_json, :expires_at, :updated_at)
             ON CONFLICT(cache_key) DO UPDATE SET
                entry_json = excluded.entry_json,
                expires_at = excluded.expires_at,
                updated_at = excluded.updated_at'
        );
        $stmt->execute([
            ':cache_key' => $normalizedKey,
            ':entry_json' => json_encode($normalizedEntry, JSON_THROW_ON_ERROR),
            ':expires_at' => $normalizedEntry->metadata->expiresAt,
            ':updated_at' => ($this->now)(),
        ]);
    }

    public function delete(string $cacheKey): void
    {
        $normalizedKey = H57::assertH57CacheKey($cacheKey, 'php-sqlite.delete');
        $stmt = $this->pdo->prepare('DELETE FROM cache_entries WHERE cache_key = ?');
        $stmt->execute([$normalizedKey]);
    }

    public function clear(): void
    {
        $this->pdo->exec('DELETE FROM cache_entries');
    }

    public function pruneExpired(?int $nowMs = null): int
    {
        $threshold = $nowMs ?? ($this->now)();
        $stmt = $this->pdo->prepare('DELETE FROM cache_entries WHERE expires_at <= ?');
        $stmt->execute([$threshold]);

        return $stmt->rowCount();
    }

    public function hydrateAllValid(?int $limit = null): array
    {
        $max = ($limit !== null && $limit > 0) ? $limit : PHP_INT_MAX;

        $stmt = $this->pdo->prepare(
            'SELECT entry_json FROM cache_entries WHERE expires_at > ? ORDER BY updated_at DESC LIMIT ?'
        );
        $stmt->bindValue(1, ($this->now)(), \PDO::PARAM_INT);
        $stmt->bindValue(2, $max, \PDO::PARAM_INT);
        $stmt->execute();

        $out = [];
        foreach ($stmt->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $entry = $this->decodeEntry($row['entry_json']);
            if ($entry !== null) {
                $out[] = $entry;
            }
        }

        return $out;
    }

    private function decodeEntry(string $entryJson): ?CacheEntry
    {
        try {
            $decoded = json_decode($entryJson, true, 512, JSON_THROW_ON_ERROR);
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
