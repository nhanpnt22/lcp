<?php

declare(strict_types=1);

namespace Lcp\Php\Tests\Storage;

use Lcp\Php\Entry\CacheEntry;
use Lcp\Php\Entry\CacheMetadata;
use Lcp\Php\Entry\CacheSource;
use Lcp\Php\Key\B57;
use Lcp\Php\Storage\SQLitePersistentStore;
use PHPUnit\Framework\TestCase;

final class SQLitePersistentStoreTest extends TestCase
{
    private string $dir;
    private int $now;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/lcp-php-sqlite-' . bin2hex(random_bytes(8));
        mkdir($this->dir, 0755, true);
        $this->now = 1000;
    }

    protected function tearDown(): void
    {
        $files = glob($this->dir . '/*') ?: [];
        foreach ($files as $file) {
            unlink($file);
        }
        rmdir($this->dir);
    }

    private function makeStore(): SQLitePersistentStore
    {
        return new SQLitePersistentStore($this->dir . '/lcp-cache.db', fn (): int => $this->now);
    }

    private function h57Key(): string
    {
        return B57::encode(random_bytes(32));
    }

    private function makeEntry(string $cacheKey, string $value, int $createdAt, int $ttlMs): CacheEntry
    {
        return new CacheEntry(
            $cacheKey,
            ['value' => $value],
            CacheMetadata::create(CacheSource::Api, $createdAt, $ttlMs, 'v1', 'v1', 'spec', 'ns', false),
        );
    }

    public function testSetThenGetReturnsValue(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 10000));

        $got = $store->get($key);
        self::assertNotNull($got);
        self::assertSame('alpha', $got->data['value']);
    }

    public function testGetOnMissingKeyReturnsNull(): void
    {
        $store = $this->makeStore();
        self::assertNull($store->get($this->h57Key()));
    }

    public function testOverwriteExistingKey(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 10000));
        $store->set($this->makeEntry($key, 'beta', 1000, 10000));

        self::assertSame('beta', $store->get($key)->data['value']);
    }

    public function testDeleteRemovesEntry(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 10000));
        $store->delete($key);

        self::assertNull($store->get($key));
    }

    public function testClearRemovesAllEntries(): void
    {
        $store = $this->makeStore();
        $key1 = $this->h57Key();
        $key2 = $this->h57Key();
        $store->set($this->makeEntry($key1, 'alpha', 1000, 10000));
        $store->set($this->makeEntry($key2, 'beta', 1000, 10000));
        $store->clear();

        self::assertNull($store->get($key1));
        self::assertNull($store->get($key2));
    }

    public function testPruneExpiredRemovesExpiredOnly(): void
    {
        $store = $this->makeStore();
        $expiredKey = $this->h57Key();
        $validKey = $this->h57Key();
        $store->set($this->makeEntry($expiredKey, 'old', 0, 100));
        $store->set($this->makeEntry($validKey, 'new', 1000, 10000));

        $removed = $store->pruneExpired(5000);

        self::assertSame(1, $removed);
        self::assertNull($store->get($expiredKey));
        self::assertSame('new', $store->get($validKey)->data['value']);
    }

    public function testHydrateAllValidExcludesExpiredAndRespectsLimit(): void
    {
        $store = $this->makeStore();
        $keyA = $this->h57Key();
        $keyB = $this->h57Key();
        $expiredKey = $this->h57Key();
        $store->set($this->makeEntry($keyA, 'va', 1000, 10000));
        $store->set($this->makeEntry($keyB, 'vb', 1000, 10000));
        $store->set($this->makeEntry($expiredKey, 'vx', 0, 100));

        $all = $store->hydrateAllValid();
        $keys = array_map(static fn (CacheEntry $e): string => $e->cacheKey, $all);
        sort($keys);
        $expected = [$keyA, $keyB];
        sort($expected);
        self::assertSame($expected, $keys);

        $limited = $store->hydrateAllValid(1);
        self::assertCount(1, $limited);
    }

    public function testHydrateAllValidOrdersByMostRecentlyUpdatedFirst(): void
    {
        $store = $this->makeStore();
        $older = $this->h57Key();
        $newer = $this->h57Key();

        $this->now = 1000;
        $store->set($this->makeEntry($older, 'old', 1000, 60000));
        $this->now = 2000;
        $store->set($this->makeEntry($newer, 'new', 2000, 60000));

        $limited = $store->hydrateAllValid(1);
        self::assertCount(1, $limited);
        self::assertSame($newer, $limited[0]->cacheKey);
    }

    public function testGetOnExpiredEntryReturnsNullAndDeletesRow(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 0, 100));

        $this->now = 5000;
        self::assertNull($store->get($key));

        $removed = $store->pruneExpired(5000);
        self::assertSame(0, $removed);
    }

    public function testInvalidCacheKeyIsRejectedOnGet(): void
    {
        $store = $this->makeStore();
        $this->expectException(\InvalidArgumentException::class);
        $store->get('not-a-valid-h57-key!');
    }

    public function testInvalidCacheKeyIsRejectedOnSet(): void
    {
        $store = $this->makeStore();
        $this->expectException(\InvalidArgumentException::class);
        $store->set($this->makeEntry('not-a-valid-h57-key!', 'alpha', 1000, 10000));
    }

    public function testDbDirectoryIsCreatedWhenMissing(): void
    {
        $nested = $this->dir . '/nested/deeper';
        $store = new SQLitePersistentStore($nested . '/lcp-cache.db', fn (): int => $this->now);
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 10000));

        self::assertSame('alpha', $store->get($key)->data['value']);

        unlink($nested . '/lcp-cache.db');
        rmdir($nested);
        rmdir(dirname($nested));
    }
}
