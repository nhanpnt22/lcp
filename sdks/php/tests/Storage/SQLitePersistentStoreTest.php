<?php

declare(strict_types=1);

namespace Lcp\Php\Tests\Storage;

use Lcp\Php\Storage\PersistentStoreInterface;
use Lcp\Php\Storage\SQLitePersistentStore;

final class SQLitePersistentStoreTest extends PersistentStoreContractTestCase
{
    private const DB_FILENAME = '/lcp-cache.db';

    protected function makeStore(): PersistentStoreInterface
    {
        return new SQLitePersistentStore(
            $this->dir . self::DB_FILENAME,
            fn (): int => $this->now,
        );
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

    public function testDbDirectoryIsCreatedWhenMissing(): void
    {
        $nested = $this->dir . '/nested/deeper';
        $store = new SQLitePersistentStore($nested . self::DB_FILENAME, fn (): int => $this->now);

        $key = $this->h57Key();
        $store->set($this->makeEntry($key, 'alpha', 1000, 10000));

        self::assertSame('alpha', $store->get($key)->data['value']);
        self::assertFileExists($nested . self::DB_FILENAME);
    }

    public function testEmptyPathIsRejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('sqlitePath is required');

        self::assertInstanceOf(SQLitePersistentStore::class, new SQLitePersistentStore('   '));
    }

    public function testEntriesPersistAcrossStoreInstances(): void
    {
        $key = $this->h57Key();
        $this->makeStore()->set($this->makeEntry($key, 'alpha', 1000, 60000));

        self::assertSame('alpha', $this->makeStore()->get($key)->data['value']);
    }
}
