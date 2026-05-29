import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:test/test.dart';

void main() {
  test('cache key material strips trace fields and is deterministic', () {
    final input = CacheKeyInput(
      namespace: 'profile',
      operationId: 'getProfile',
      payload: {
        'b': 2,
        'a': 1,
        'trace_id': 'abc',
      },
      schemaVersion: 'v1',
      specChecksum: 'spec',
      userScope: 'u1',
    );

    final materialA = buildCacheKeyMaterial(input);
    final materialB = buildCacheKeyMaterial(input);
    expect(materialA, equals(materialB));
    expect(materialA.contains('trace_id'), isFalse);
  });
}
