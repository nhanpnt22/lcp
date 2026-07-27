<?php

declare(strict_types=1);

namespace Lcp\Php\Entry;

enum CacheSource: string
{
    case Api = 'API';
    case Cache = 'CACHE';
}
