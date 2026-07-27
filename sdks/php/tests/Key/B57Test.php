<?php

declare(strict_types=1);

namespace Lcp\Php\Tests\Key;

use Lcp\Php\Key\B57;
use Lcp\Php\Key\B57Exception;
use PHPUnit\Framework\TestCase;

final class B57Test extends TestCase
{
    public function testEmptyInputRoundTrips(): void
    {
        self::assertSame('', B57::encode(''));
        self::assertSame('', B57::decode(''));
    }

    public function testRoundTripForRandomByteStrings(): void
    {
        for ($i = 0; $i < 50; $i++) {
            $bytes = random_bytes(random_int(1, 64));
            $encoded = B57::encode($bytes);
            self::assertTrue(B57::isValid($encoded));
            self::assertTrue(B57::isCanonical($encoded));
            self::assertSame($bytes, B57::decode($encoded));
        }
    }

    public function testLeadingZeroBytesArePreserved(): void
    {
        $bytes = "\x00\x00\x01\x02";
        $encoded = B57::encode($bytes);
        self::assertStringStartsWith('AA', $encoded);
        self::assertSame($bytes, B57::decode($encoded));
    }

    public function testAllZeroBytesEncodeToAllFirstAlphabetChar(): void
    {
        $bytes = "\x00\x00\x00";
        $encoded = B57::encode($bytes);
        self::assertSame('AAA', $encoded);
        self::assertSame($bytes, B57::decode($encoded));
    }

    public function testIsValidRejectsExcludedAndForeignCharacters(): void
    {
        foreach (['0', 'O', 'I', 'l', ' ', '-', '_', '!'] as $char) {
            self::assertFalse(B57::isValid('AB' . $char . 'CD'), "expected '{$char}' to be rejected");
        }
    }

    public function testIsValidAcceptsEmptyString(): void
    {
        self::assertTrue(B57::isValid(''));
    }

    public function testDecodeThrowsOnInvalidCharacters(): void
    {
        $this->expectException(B57Exception::class);
        B57::decode('AB0CD');
    }

    public function testIsCanonicalFalseForInvalidCharacters(): void
    {
        self::assertFalse(B57::isCanonical('AB0CD'));
    }
}
