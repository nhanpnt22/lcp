<?php

declare(strict_types=1);

namespace Lcp\Php\Key;

/**
 * H57 cache-key validation, aligned with the Go/NodeJS/Flutter SDKs
 * (`validateH57CacheKey` / `assertH57CacheKey`): a cache key is a
 * canonical B57-encoded hash string. This SDK only validates the
 * format (it does not compute H57 hashes itself, matching how the
 * NodeJS and Go persistent stores only validate incoming cache keys).
 */
final class H57
{
    private function __construct()
    {
    }

    public static function isValid(string $value): bool
    {
        return B57::isValid($value);
    }

    public static function isCanonical(string $value): bool
    {
        return B57::isCanonical($value);
    }

    public static function isH57CacheKey(string $cacheKey): bool
    {
        $value = trim($cacheKey);
        if ($value === '') {
            return false;
        }

        return self::isValid($value) && self::isCanonical($value);
    }

    public static function assertH57CacheKey(string $cacheKey, string $operation): string
    {
        $value = trim($cacheKey);
        if (!self::isH57CacheKey($value)) {
            throw new \InvalidArgumentException(
                sprintf('invalid cache_key for %s: expected canonical H57', $operation)
            );
        }

        return $value;
    }
}
