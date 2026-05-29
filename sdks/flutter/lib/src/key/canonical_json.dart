import 'dart:convert';

Object? normalizeCanonicalValue(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value.toUtc().toIso8601String();
  if (value is bool || value is String) return value;
  if (value is num) {
    if (!value.isFinite) {
      throw ArgumentError(
          'Non-finite numbers are not allowed in canonical JSON');
    }
    if (value == 0) return 0;
    return value;
  }
  if (value is List) {
    return value.map(normalizeCanonicalValue).toList(growable: false);
  }
  if (value is Map) {
    final sortedKeys = value.keys.map((k) => k.toString()).toList()..sort();
    final normalized = <String, Object?>{};
    for (final key in sortedKeys) {
      final item = value[key] ?? value[key as Object?];
      normalized[key] = normalizeCanonicalValue(item);
    }
    return normalized;
  }
  throw ArgumentError(
      'Unsupported value type in canonical JSON: ${value.runtimeType}');
}

String canonicalJsonStringify(Object? value) {
  return jsonEncode(normalizeCanonicalValue(value));
}
