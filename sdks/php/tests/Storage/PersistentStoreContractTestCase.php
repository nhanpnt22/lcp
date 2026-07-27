<?php

declare(strict_types=1);

namespace Lcp\Php\Tests\Storage;

use Lcp\Php\Entry\CacheEntry;
use Lcp\Php\Entry\CacheMetadata;
use Lcp\Php\Entry\CacheSource;
use Lcp\Php\Key\B57;
use Lcp\Php\Storage\PersistentStoreInterface;
use PHPUnit\Framework\TestCase;

/**
 * Shared persistent-store contract, run against every backend.
 *
 * Mirrors `runStoreContractSuite` in the NodeJS SDK
 * (`sdks/nodejs/tests/persistent.store.contract.test.ts`) and the Go/Flutter
 * contract suites, so all backends are held to the same behavior.
 *
 * Ordering is deliberately not asserted here: the SQLite backend returns
 * `hydrateAllValid()` results most-recently-updated first while the file
 * backend returns them by cache key. Each backend pins its own ordering in
 * its own test case.
 */
abstract class PersistentStoreContractTestCase extends TestCase
{
    protected string $dir;
    protected int $now = 1000;

    abstract protected function makeStore(): PersistentStoreInterface;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/lcp-php-store-' . bin2hex(random_bytes(8));
        mkdir($this->dir, 0755, true);
        $this->now = 1000;
    }

    protected function tearDown(): void
    {
        $this->removeDir($this->dir);
    }

    protected function removeDir(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach (scandir($dir) ?: [] as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }
            $path = $dir . \DIRECTORY_SEPARATOR . $name;
            is_dir($path) ? $this->removeDir($path) : unlink($path);
        }
        rmdir($dir);
    }

    protected function h57Key(): string
    {
        return B57::encode(random_bytes(32));
    }

    protected function makeEntry(string $cacheKey, string $value, int $createdAt, int $ttlMs): CacheEntry
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
        self::assertNull($this->makeStore()->get($this->h57Key()));
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

    public function testDeleteMissingKeyIsNoop(): void
    {
        $store = $this->makeStore();
        $store->delete($this->h57Key());

        $this->expectNotToPerformAssertions();
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

        $keys = array_map(
            static fn (CacheEntry $e): string => $e->cacheKey,
            $store->hydrateAllValid(),
        );
        sort($keys);
        $expected = [$keyA, $keyB];
        sort($expected);
        self::assertSame($expected, $keys);

        self::assertCount(1, $store->hydrateAllValid(1));
    }

    public function testHydrateAllValidOnEmptyStoreReturnsEmptyArray(): void
    {
        self::assertSame([], $this->makeStore()->hydrateAllValid());
    }

    public function testGetOnExpiredEntryReturnsNullAndRemovesIt(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 0, 100));

        $this->now = 5000;
        self::assertNull($store->get($key));

        // Lazy expiry on read already removed it, so there is nothing left to prune.
        self::assertSame(0, $store->pruneExpired(5000));
    }

    public function testInvalidCacheKeyIsRejectedOnGet(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->makeStore()->get('not-a-valid-h57-key!');
    }

    public function testInvalidCacheKeyIsRejectedOnSet(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->makeStore()->set($this->makeEntry('not-a-valid-h57-key!', 'alpha', 1000, 10000));
    }

    public function testInvalidCacheKeyIsRejectedOnDelete(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->makeStore()->delete('not-a-valid-h57-key!');
    }

    public function testStoresAtLeastOneVisibleValue(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 86400000));

        $got = $store->get($key);
        self::assertNotNull($got);
        self::assertSame('alpha', $got->data['value']);
    }

    public function testRoundTripPreservesMetadata(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 10000));

        $metadata = $store->get($key)->metadata;
        self::assertSame(CacheSource::Api, $metadata->source);
        self::assertSame(1000, $metadata->createdAt);
        self::assertSame(11000, $metadata->expiresAt);
        self::assertSame(10000, $metadata->ttlMs);
        self::assertSame('v1', $metadata->schemaVersion);
        self::assertSame('v1', $metadata->dataVersion);
        self::assertSame('spec', $metadata->specChecksum);
        self::assertSame('ns', $metadata->cacheNamespace);
        self::assertFalse($metadata->compressed);
    }
}
