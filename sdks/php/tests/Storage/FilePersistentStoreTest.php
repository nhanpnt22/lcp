<?php

declare(strict_types=1);

namespace Lcp\Php\Tests\Storage;

use Lcp\Php\Entry\CacheEntry;
use Lcp\Php\Storage\FilePersistentStore;
use Lcp\Php\Storage\PersistentStoreInterface;

final class FilePersistentStoreTest extends PersistentStoreContractTestCase
{
    protected function makeStore(): PersistentStoreInterface
    {
        return new FilePersistentStore($this->dir . '/cache', fn (): int => $this->now);
    }

    private function cacheDir(): string
    {
        return $this->dir . '/cache';
    }

    public function testHydrateAllValidOrdersByCacheKeyAscending(): void
    {
        $store = $this->makeStore();
        $keys = [$this->h57Key(), $this->h57Key(), $this->h57Key()];
        foreach ($keys as $i => $key) {
            $store->set($this->makeEntry($key, "v{$i}", 1000, 60000));
        }

        $got = array_map(
            static fn (CacheEntry $e): string => $e->cacheKey,
            $store->hydrateAllValid(),
        );

        $expected = $keys;
        sort($expected, SORT_STRING);
        self::assertSame($expected, $got);
    }

    public function testEntryIsStoredAsJsonFileNamedByCacheKey(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 10000));

        $expectedPath = $this->cacheDir() . '/' . $key . '.json';
        self::assertFileExists($expectedPath);

        $decoded = json_decode((string) file_get_contents($expectedPath), true, 512, JSON_THROW_ON_ERROR);
        self::assertSame($key, $decoded['cache_key']);
        self::assertSame('alpha', $decoded['data']['value']);
        self::assertSame(11000, $decoded['metadata']['expires_at']);
    }

    public function testRootDirIsCreatedWhenMissing(): void
    {
        $nested = $this->dir . '/nested/deeper';
        $store = new FilePersistentStore($nested, fn (): int => $this->now);

        self::assertDirectoryDoesNotExist($nested);

        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 10000));

        self::assertDirectoryExists($nested);
        self::assertSame('alpha', $store->get($key)->data['value']);
    }

    public function testWriteLeavesNoTempFileBehind(): void
    {
        $store = $this->makeStore();
        $store->set($this->makeEntry($this->h57Key(), 'alpha', 1000, 10000));

        self::assertSame([], glob($this->cacheDir() . '/*.tmp') ?: []);
    }

    public function testEmptyRootDirIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('rootDir is required');

        self::assertInstanceOf(FilePersistentStore::class, new FilePersistentStore('   '));
    }

    public function testOperationsOnMissingRootDirAreSafe(): void
    {
        $store = new FilePersistentStore($this->dir . '/never-created', fn (): int => $this->now);

        self::assertSame([], $store->hydrateAllValid());
        self::assertSame(0, $store->pruneExpired(5000));
        $store->clear();
        self::assertNull($store->get($this->h57Key()));
    }

    public function testCorruptFileIsIgnoredRatherThanFatal(): void
    {
        $store = $this->makeStore();
        $validKey = $this->h57Key();
        $store->set($this->makeEntry($validKey, 'alpha', 1000, 60000));

        file_put_contents($this->cacheDir() . '/' . $this->h57Key() . '.json', '{not valid json');

        $hydrated = $store->hydrateAllValid();
        self::assertCount(1, $hydrated);
        self::assertSame($validKey, $hydrated[0]->cacheKey);
    }

    public function testNonJsonFilesAreIgnored(): void
    {
        $store = $this->makeStore();
        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 60000));
        file_put_contents($this->cacheDir() . '/README.txt', 'not a cache entry');

        self::assertCount(1, $store->hydrateAllValid());
    }

    public function testEntriesPersistAcrossStoreInstances(): void
    {
        $key = $this->h57Key();
        $this->makeStore()->set($this->makeEntry($key, 'alpha', 1000, 60000));

        self::assertSame('alpha', $this->makeStore()->get($key)->data['value']);
    }
}
