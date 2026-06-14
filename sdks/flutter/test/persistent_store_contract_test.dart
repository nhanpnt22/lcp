import 'dart:collection';
import 'dart:io';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';
import 'package:test/test.dart';

void main() {
  sqfliteFfiInit();

  group('PersistentStore contract', () {
    test('set/get value after set', () async {
      await runPerStore((store) async {
        final key = _h57Key('k1');
        await store.set(_entry(
            cacheKey: key, value: 'alpha', createdAt: 1000, ttlMs: 10000));
        final got = await store.get(key);
        expect(got, isNotNull);
        expect(got!.data['value'], equals('alpha'));
      });
    });

    test('overwrite existing key', () async {
      await runPerStore((store) async {
        final key = _h57Key('k1');
        await store.set(_entry(
            cacheKey: key, value: 'alpha', createdAt: 1000, ttlMs: 10000));
        await store.set(_entry(
            cacheKey: key, value: 'beta', createdAt: 1000, ttlMs: 10000));
        final got = await store.get(key);
        expect(got, isNotNull);
        expect(got!.data['value'], equals('beta'));
      });
    });

    test('delete removes entry', () async {
      await runPerStore((store) async {
        final key = _h57Key('k1');
        await store.set(_entry(
            cacheKey: key, value: 'alpha', createdAt: 1000, ttlMs: 10000));
        await store.delete(key);
        final got = await store.get(key);
        expect(got, isNull);
      });
    });

    test('clear removes all entries', () async {
      await runPerStore((store) async {
        final key1 = _h57Key('k1');
        final key2 = _h57Key('k2');
        await store.set(_entry(
            cacheKey: key1, value: 'alpha', createdAt: 1000, ttlMs: 10000));
        await store.set(_entry(
            cacheKey: key2, value: 'beta', createdAt: 1000, ttlMs: 10000));
        await store.clear();
        final got1 = await store.get(key1);
        final got2 = await store.get(key2);
        expect(got1, isNull);
        expect(got2, isNull);
      });
    });

    test('pruneExpired removes expired only', () async {
      await runPerStore((store) async {
        final expiredKey = _h57Key('expired');
        final validKey = _h57Key('valid');
        await store.set(_entry(
            cacheKey: expiredKey, value: 'old', createdAt: 0, ttlMs: 100));
        await store.set(_entry(
            cacheKey: validKey, value: 'new', createdAt: 1000, ttlMs: 10000));
        final removed = await store.pruneExpired(now: 5000);
        final expired = await store.get(expiredKey);
        final valid = await store.get(validKey);
        expect(removed, equals(1));
        expect(expired, isNull);
        expect(valid, isNotNull);
        expect(valid!.data['value'], equals('new'));
      });
    });

    test('hydrateAllValid excludes expired and respects limit', () async {
      await runPerStore((store) async {
        final keyA = _h57Key('a');
        final keyB = _h57Key('b');
        final expiredKey = _h57Key('expired');
        await store.set(
            _entry(cacheKey: keyA, value: 'va', createdAt: 1000, ttlMs: 10000));
        await store.set(
            _entry(cacheKey: keyB, value: 'vb', createdAt: 1000, ttlMs: 10000));
        await store.set(_entry(
            cacheKey: expiredKey, value: 'vx', createdAt: 0, ttlMs: 100));

        final all = await store.hydrateAllValid(now: 5000);
        final keys = all.map((entry) => entry.cacheKey).toList()..sort();
        final limited = await store.hydrateAllValid(now: 5000, limit: 1);

        final expected = [keyA, keyB]..sort();
        expect(keys, equals(expected));
        expect(limited.length, equals(1));
      });
    });

    test('set cache value for at least one value in storage', () async {
      await runPerStore((store) async {
        final key = _h57Key('visible-evidence');
        await store.set(_entry(
            cacheKey: key, value: 'alpha', createdAt: 1000, ttlMs: 86400000));
        final got = await store.get(key);
        expect(got, isNotNull);
        expect(got!.data['value'], equals('alpha'));
      });
    });
  });
}

Future<void> runPerStore(
    Future<void> Function(PersistentCacheStore<Map<String, Object?>> store)
        run) async {
  final factories = <_StoreFactory>[
    _StoreFactory(
      name: 'memory',
      create: () async =>
          _MemoryPersistentStore<Map<String, Object?>>(now: () => 1000),
      dispose: (_) async {},
    ),
    _StoreFactory(
      name: 'sqlite',
      create: () async {
        final dir =
            await Directory.systemTemp.createTemp('lcp_flutter_contract_');
        final store = SqlitePersistentCacheStore<Map<String, Object?>>(
          toJson: (value) => value,
          fromJson: (json) => Map<String, Object?>.from(json as Map),
          now: () => DateTime.fromMillisecondsSinceEpoch(1000),
          databaseFactory: databaseFactoryFfi,
          databasePathResolver: () async => dir.path,
          dbName: 'contract.db',
        );
        return _SqliteHarness(store: store, dir: dir);
      },
      dispose: (harness) async {
        if (harness is _SqliteHarness) {
          await harness.store.close();
          if (await harness.dir.exists()) {
            await harness.dir.delete(recursive: true);
          }
        }
      },
    ),
    _StoreFactory(
      name: 'file',
      create: () async {
        final dir =
            await Directory.systemTemp.createTemp('lcp_flutter_contract_file_');
        final store = FilePersistentCacheStore<Map<String, Object?>>(
          toJson: (value) => value,
          fromJson: (json) => Map<String, Object?>.from(json as Map),
          now: () => DateTime.fromMillisecondsSinceEpoch(1000),
          rootDirResolver: () async => dir.path,
        );
        return _FileHarness(store: store, dir: dir);
      },
      dispose: (harness) async {
        if (harness is _FileHarness) {
          if (await harness.dir.exists()) {
            await harness.dir.delete(recursive: true);
          }
        }
      },
    ),
  ];

  for (final factory in factories) {
    final created = await factory.create();
    final store = switch (created) {
      _SqliteHarness h => h.store,
      _FileHarness h => h.store,
      _ => created as PersistentCacheStore<Map<String, Object?>>,
    };
    try {
      await run(store);
    } finally {
      await factory.dispose(created);
    }
  }
}

CacheEntry<Map<String, Object?>> _entry({
  required String cacheKey,
  required String value,
  required int createdAt,
  required int ttlMs,
}) {
  return CacheEntry<Map<String, Object?>>(
    cacheKey: cacheKey,
    data: {'value': value},
    metadata: createCacheMetadata(
      source: CacheSource.api,
      createdAt: createdAt,
      ttlMs: ttlMs,
      schemaVersion: 'v1',
      dataVersion: 'v1',
      specChecksum: 'spec',
      cacheNamespace: 'ns',
    ),
  );
}

String _h57Key(String label) {
  return computeCacheKey(
    CacheKeyInput(
      namespace: 'contract',
      operationId: label,
      payload: {'suite': 'persistent-store', 'label': label},
      schemaVersion: 'v1',
      specChecksum: 'spec-v1',
      userScope: 'test-user',
    ),
    h57HashFn,
  );
}

class _StoreFactory {
  const _StoreFactory({
    required this.name,
    required this.create,
    required this.dispose,
  });

  final String name;
  final Future<Object> Function() create;
  final Future<void> Function(Object created) dispose;
}

class _SqliteHarness {
  const _SqliteHarness({
    required this.store,
    required this.dir,
  });

  final SqlitePersistentCacheStore<Map<String, Object?>> store;
  final Directory dir;
}

class _FileHarness {
  const _FileHarness({
    required this.store,
    required this.dir,
  });

  final FilePersistentCacheStore<Map<String, Object?>> store;
  final Directory dir;
}

class _MemoryPersistentStore<T> implements PersistentCacheStore<T> {
  _MemoryPersistentStore({required int Function() now}) : _now = now;

  final int Function() _now;
  final LinkedHashMap<String, CacheEntry<T>> _entries = LinkedHashMap();

  @override
  Future<void> clear() async {
    _entries.clear();
  }

  @override
  Future<void> delete(String cacheKey) async {
    _entries.remove(cacheKey);
  }

  @override
  Future<CacheEntry<T>?> get(String cacheKey) async {
    final entry = _entries[cacheKey];
    if (entry == null) {
      return null;
    }
    if (_now() >= entry.metadata.expiresAt) {
      _entries.remove(cacheKey);
      return null;
    }
    return entry;
  }

  @override
  Future<List<CacheEntry<T>>> hydrateAllValid(
      {required int now, int? limit}) async {
    final out = <CacheEntry<T>>[];
    final max = limit ?? 0x7fffffff;

    for (final entry in _entries.values) {
      if (now < entry.metadata.expiresAt) {
        out.add(entry);
      }
      if (out.length >= max) {
        break;
      }
    }

    return out;
  }

  @override
  Future<int> pruneExpired({required int now}) async {
    final keys = _entries.entries
        .where((kv) => now >= kv.value.metadata.expiresAt)
        .map((kv) => kv.key)
        .toList(growable: false);
    for (final key in keys) {
      _entries.remove(key);
    }
    return keys.length;
  }

  @override
  Future<void> set(CacheEntry<T> entry) async {
    _entries[entry.cacheKey] = entry;
  }
}
