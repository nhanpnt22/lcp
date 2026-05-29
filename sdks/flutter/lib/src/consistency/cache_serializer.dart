import '../key/canonical_json.dart';

Object? canonicalize(Object? value) => normalizeCanonicalValue(value);

String deterministicSerialize(Object? value) => canonicalJsonStringify(value);

bool isDeterministicallyEqual(Object? left, Object? right) {
  return deterministicSerialize(left) == deterministicSerialize(right);
}
