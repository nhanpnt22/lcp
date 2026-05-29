# LCP Flutter SDK

Deterministic read-through local cache SDK for Flutter/Dart clients, aligned with LCP v1.0.0.

## Protocol Alignment

- Parent protocol: https://github.com/nhanpnt22/lcp/blob/main/docs/LCP%20%E2%80%94%20Local%20Cache%20Protocol.txt
- Language profile: https://github.com/nhanpnt22/lcp/blob/main/profiles/flutter/LCP%20%E2%80%94%20Flutter%20SDK%20Profile(Mobile).txt

This SDK preserves protocol invariants: deterministic keying, non-authoritative read-through behavior, no-backflow, and parity-safe metadata handling.

Parity tracking across JavaScript and Flutter SDKs is maintained in `../PARITY_MATRIX.md`.

## Status

Early release candidate (`0.1.1`) focused on core deterministic engine behavior.

## Features

- Read-through cache engine (`memory -> optional persistent -> API`)
- Deterministic cache key material and hash injection
- Metadata parity and invariant validation
- Optional single-flight for in-flight deduplication
- Optional stale-while-revalidate callback hook
- Advisory resume/state alignment support
- Namespace isolation helpers
- Trace context helpers and trace-field stripping
- Failure classification and fallback helpers
- Optional compression codec wrappers

## Install

```yaml
dependencies:
  lcp_flutter_sdk: ^0.1.1
```

## Quick Start

```dart
import 'dart:convert';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';

void main() async {
  final memoryStore = MemoryCacheStore<Map<String, dynamic>>(maxEntries: 500);

  final engine = ReadThroughCacheEngine<Map<String, dynamic>>(
    memoryStore: memoryStore,
    parity: const CacheParity(
      schemaVersion: 'v1',
      dataVersion: 'v1',
      specChecksum: 'spec-abc',
      cacheNamespace: 'widget-profile',
    ),
  );

  String hashFn(List<int> bytes) => base64Url.encode(bytes);

  final result = await engine.execute(
    CacheRequest<Map<String, dynamic>>(
      keyInput: CacheKeyInput(
        namespace: 'profile',
        operationId: 'getProfile',
        payload: {'userId': 'u1'},
        schemaVersion: 'v1',
        specChecksum: 'spec-abc',
        userScope: 'u1',
      ),
      hashFn: hashFn,
      fetchFromApi: () async => const ApiFetchResult(
        data: {'name': 'Alice'},
        ttlMs: 30 * 1000,
      ),
    ),
  );

  print('${result.source} ${result.stale} ${result.data}');
}
```

## SQLite Persistence

Use `SqlitePersistentCacheStore` to persist cache entries across app restarts.

```dart
import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:sqflite/sqflite.dart' as sqflite;

final persistentStore = SqlitePersistentCacheStore<Map<String, dynamic>>(
  toJson: (value) => value,
  fromJson: (json) => Map<String, dynamic>.from(json as Map),
  databaseFactory: sqflite.databaseFactory,
  databasePathResolver: sqflite.getDatabasesPath,
);

final engine = ReadThroughCacheEngine<Map<String, dynamic>>(
  memoryStore: MemoryCacheStore(maxEntries: 500),
  persistentStore: persistentStore,
  parity: const CacheParity(
    schemaVersion: 'v1',
    dataVersion: 'v1',
    specChecksum: 'spec-abc',
    cacheNamespace: 'widget-profile',
  ),
);
```

## Verification

```bash
dart format --set-exit-if-changed .
dart analyze
dart test
dart pub publish --dry-run
```

Detailed release gates and test portfolio are documented in `TEST_PLAN.md`.
Cross-SDK parity checks are documented in `../PARITY_MATRIX.md`.

## License

MIT
