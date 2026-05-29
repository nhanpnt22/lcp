import 'package:lcp_flutter_sdk/lcp_flutter_sdk.dart';
import 'package:test/test.dart';

void main() {
  test('deterministicSerialize yields same output for key-order variants', () {
    final a = {'b': 2, 'a': 1};
    final b = {'a': 1, 'b': 2};

    expect(deterministicSerialize(a), equals(deterministicSerialize(b)));
    expect(isDeterministicallyEqual(a, b), isTrue);
  });

  test('canonicalize normalizes DateTime to ISO string', () {
    final dt = DateTime.parse('2026-01-01T00:00:00Z');
    final normalized = canonicalize({'t': dt}) as Map<String, Object?>;
    expect(normalized['t'], equals('2026-01-01T00:00:00.000Z'));
  });
}
