import 'dart:typed_data';

import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:test/test.dart';

void main() {
  test('namespace helpers validate and build deterministic prefix', () {
    final scope = NamespaceScope(cacheNamespace: 'ns', userScope: 'u1');
    expect(buildIsolationPrefix(scope), equals('ns:u1'));
    expect(isNamespaceMatch('ns', 'ns'), isTrue);
    expect(() => assertNamespaceMatch('ns', 'other'), throwsStateError);
  });

  test('trace helpers strip trace fields and enforce equality', () {
    final trace = TraceContext(traceId: 't1', actionId: 'a1', requestId: 'r1');
    final propagated = propagateTraceContext(trace);
    expect(isTraceContextEqual(trace, propagated), isTrue);

    final stripped = stripTraceFields({
      'trace_id': 'x',
      'payload': {
        'request_id': 'r',
        'ok': true,
      },
    });
    expect(
        stripped,
        equals({
          'payload': {'ok': true}
        }));
  });

  test('compression helpers round-trip with codec registry', () async {
    final codec = _ReverseCodec();
    final registry = createCodecRegistry([codec]);

    final packet = await compressDeterministic(
      'abcdef',
      options: CompressionOptions(codec: codec, minBytes: 1),
    );
    final value = await decompressDeterministic(packet, registry: registry);
    expect(value, equals('abcdef'));
  });

  test('failure classifier returns stale path when allowed', () async {
    final staleEntry = CacheEntry<Map<String, Object>>(
      cacheKey: 'k',
      data: {'ok': true},
      metadata: createCacheMetadata(
        source: CacheSource.cache,
        createdAt: 0,
        ttlMs: 1,
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
    );

    final decision = classifyCacheFailure(
      CacheFailureInput<Map<String, Object>>(
        stage: CacheFailureStage.memoryRead,
        error: StateError('boom'),
        staleEntry: staleEntry,
        allowStale: true,
      ),
    );

    final result = await executeWithApiFallback(
      decision: decision,
      fetchFromApi: () async => {'api': true},
    );

    expect(result.source, equals(FallbackSource.cache));
    expect(result.value['ok'], isTrue);
  });

  test('scheduleSwrRefresh updates memory with refreshed data', () async {
    final memory =
        MemoryCacheStore<Map<String, Object>>(maxEntries: 5, now: () => 10);
    final stale = CacheEntry<Map<String, Object>>(
      cacheKey: 'k1',
      data: {'v': 'old'},
      metadata: createCacheMetadata(
        source: CacheSource.cache,
        createdAt: 0,
        ttlMs: 5,
        schemaVersion: 'v1',
        dataVersion: 'v1',
        specChecksum: 'spec',
        cacheNamespace: 'ns',
      ),
    );
    memory.set(stale);

    scheduleSwrRefresh(
      SwrRefreshRequest<Map<String, Object>>(
        cacheKey: 'k1',
        staleEntry: stale,
        requestId: 'r1',
        singleFlight: CacheSingleFlight<void>(),
        memoryStore: memory,
        fetchFromApi: (_) async => const SwrFetchResult<Map<String, Object>>(
          data: {'v': 'new'},
          ttlMs: 100,
        ),
        parity: const CacheMetadataParityExpectation(
          schemaVersion: 'v1',
          specChecksum: 'spec',
          cacheNamespace: 'ns',
        ),
        now: () => 10,
      ),
    );

    await Future<void>.delayed(const Duration(milliseconds: 10));
    final refreshed = memory.get('k1');
    expect(refreshed, isNotNull);
    expect(refreshed!.data['v'], equals('new'));
  });
}

class _ReverseCodec implements CompressionCodec {
  @override
  String get name => 'reverse';

  @override
  Future<Uint8List> compress(Uint8List input) async {
    return Uint8List.fromList(input.reversed.toList(growable: false));
  }

  @override
  Future<Uint8List> decompress(Uint8List input) async {
    return Uint8List.fromList(input.reversed.toList(growable: false));
  }
}
