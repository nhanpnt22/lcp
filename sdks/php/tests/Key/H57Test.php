<?php

declare(strict_types=1);

namespace Lcp\Php\Tests\Key;

use Lcp\Php\Key\B57;
use Lcp\Php\Key\H57;
use PHPUnit\Framework\TestCase;

final class H57Test extends TestCase
{
    public function testValidCanonicalKeyIsAccepted(): void
    {
        $key = B57::encode(random_bytes(32));
        self::assertTrue(H57::isH57CacheKey($key));
        self::assertSame($key, H57::assertH57CacheKey($key, 'test'));
    }

    public function testWhitespaceIsTrimmed(): void
    {
        $key = B57::encode(random_bytes(32));
        self::assertSame($key, H57::assertH57CacheKey("  {$key}  ", 'test'));
    }

    public function testEmptyKeyIsRejected(): void
    {
        self::assertFalse(H57::isH57CacheKey(''));
        self::assertFalse(H57::isH57CacheKey('   '));
    }

    public function testInvalidCharacterIsRejected(): void
    {
        self::assertFalse(H57::isH57CacheKey('not-a-valid-h57-key!'));
    }

    public function testAssertThrowsWithOperationContext(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('invalid cache_key for my-op: expected canonical H57');
        H57::assertH57CacheKey('!!!', 'my-op');
    }
}
