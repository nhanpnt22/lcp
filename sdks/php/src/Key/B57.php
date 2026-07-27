<?php

declare(strict_types=1);

namespace Lcp\Php\Key;

/**
 * B57 binary-to-text encoding, ported from the reference implementation at
 * https://github.com/nhanpnt22/f57 (implementations/go/b57.go) to keep this
 * SDK dependency-free (no ext-gmp/ext-bcmath requirement).
 *
 * Alphabet: ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789
 * (excludes 0, O, I, l). Encoding is deterministic, bijective, and
 * preserves all input entropy; every valid-alphabet string is canonical
 * by construction (leading zero bytes map 1:1 to leading 'A' characters,
 * and the remaining base-57 numeral never carries a redundant leading
 * zero digit).
 */
final class B57
{
    public const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz123456789';
    public const BASE = 57;

    /** @var array<int, int>|null */
    private static ?array $alphaIndex = null;

    private function __construct()
    {
    }

    public static function encode(string $data): string
    {
        $len = strlen($data);
        if ($len === 0) {
            return '';
        }

        $bytes = array_values(unpack('C*', $data));

        $leadingZeros = 0;
        foreach ($bytes as $b) {
            if ($b === 0) {
                $leadingZeros++;
            } else {
                break;
            }
        }

        if ($leadingZeros === $len) {
            return str_repeat(self::ALPHABET[0], $len);
        }

        $digits = array_slice($bytes, $leadingZeros);
        $remainders = [];
        while (!self::isZero($digits)) {
            [$digits, $remainder] = self::divmod($digits, self::BASE);
            $digits = self::stripLeadingZeros($digits);
            $remainders[] = self::ALPHABET[$remainder];
        }

        $result = implode('', array_reverse($remainders));

        return str_repeat(self::ALPHABET[0], $leadingZeros) . $result;
    }

    public static function decode(string $s): string
    {
        if ($s === '') {
            return '';
        }

        self::validateCharacters($s);

        $len = strlen($s);
        $index = self::alphaIndex();

        $leadingZeros = 0;
        for ($i = 0; $i < $len; $i++) {
            if ($index[ord($s[$i])] === 0) {
                $leadingZeros++;
            } else {
                break;
            }
        }

        if ($leadingZeros === $len) {
            $result = str_repeat("\x00", $len);
            self::verifyCanonical($s, $result);
            return $result;
        }

        $numStr = substr($s, $leadingZeros);
        $digits = [0];
        for ($i = 0, $n = strlen($numStr); $i < $n; $i++) {
            $digits = self::mulAdd($digits, self::BASE, $index[ord($numStr[$i])]);
        }
        $digits = self::stripLeadingZeros($digits);
        if ($digits === [0]) {
            $digits = [];
        }

        $result = str_repeat("\x00", $leadingZeros) . self::digitsToString($digits);

        self::verifyCanonical($s, $result);

        return $result;
    }

    public static function isValid(string $s): bool
    {
        if ($s === '') {
            return true;
        }

        $index = self::alphaIndex();
        for ($i = 0, $len = strlen($s); $i < $len; $i++) {
            if ($index[ord($s[$i])] === -1) {
                return false;
            }
        }

        return true;
    }

    public static function isCanonical(string $s): bool
    {
        if ($s === '') {
            return true;
        }

        if (!self::isValid($s)) {
            return false;
        }

        try {
            $decoded = self::decode($s);
        } catch (B57Exception) {
            return false;
        }

        return self::encode($decoded) === $s;
    }

    /**
     * @param array<int, int> $digits big-endian base-256 limbs
     * @return array{0: array<int, int>, 1: int}
     */
    private static function divmod(array $digits, int $base): array
    {
        $quotient = [];
        $carry = 0;
        foreach ($digits as $d) {
            $carry = ($carry << 8) | $d;
            $quotient[] = intdiv($carry, $base);
            $carry %= $base;
        }

        return [$quotient, $carry];
    }

    /**
     * @param array<int, int> $digits big-endian base-256 limbs
     * @return array<int, int>
     */
    private static function mulAdd(array $digits, int $mul, int $add): array
    {
        $carry = $add;
        for ($i = count($digits) - 1; $i >= 0; $i--) {
            $carry = $digits[$i] * $mul + $carry;
            $digits[$i] = $carry & 0xFF;
            $carry >>= 8;
        }
        while ($carry > 0) {
            array_unshift($digits, $carry & 0xFF);
            $carry >>= 8;
        }

        return $digits;
    }

    /** @param array<int, int> $digits */
    private static function isZero(array $digits): bool
    {
        foreach ($digits as $d) {
            if ($d !== 0) {
                return false;
            }
        }

        return true;
    }

    /**
     * @param array<int, int> $digits
     * @return array<int, int>
     */
    private static function stripLeadingZeros(array $digits): array
    {
        $i = 0;
        $last = count($digits) - 1;
        while ($i < $last && $digits[$i] === 0) {
            $i++;
        }

        return array_slice($digits, $i);
    }

    /** @param array<int, int> $digits */
    private static function digitsToString(array $digits): string
    {
        if ($digits === []) {
            return '';
        }

        return pack('C*', ...$digits);
    }

    private static function validateCharacters(string $s): void
    {
        if (!self::isValid($s)) {
            throw new B57Exception('invalid character in B57 string');
        }
    }

    private static function verifyCanonical(string $original, string $decoded): void
    {
        if (self::encode($decoded) !== $original) {
            throw new B57Exception('non-canonical B57 string');
        }
    }

    /** @return array<int, int> */
    private static function alphaIndex(): array
    {
        if (self::$alphaIndex === null) {
            $map = array_fill(0, 256, -1);
            foreach (str_split(self::ALPHABET) as $i => $char) {
                $map[ord($char)] = $i;
            }
            self::$alphaIndex = $map;
        }

        return self::$alphaIndex;
    }
}
