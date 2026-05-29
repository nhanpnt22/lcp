import 'dart:convert';

import 'canonical_json.dart';

typedef HashFn = String Function(List<int> bytes);

class CacheKeyInput {
  const CacheKeyInput({
    required this.namespace,
    required this.operationId,
    required this.payload,
    required this.schemaVersion,
    required this.specChecksum,
    required this.userScope,
  });

  final String namespace;
  final String operationId;
  final Object? payload;
  final String schemaVersion;
  final String specChecksum;
  final String userScope;
}

const _traceFields = <String>{'trace_id', 'action_id', 'request_id'};

Object? _stripTraceFields(Object? value) {
  if (value is List) {
    return value.map(_stripTraceFields).toList(growable: false);
  }
  if (value is Map) {
    final output = <String, Object?>{};
    value.forEach((key, item) {
      final normalizedKey = key.toString();
      if (_traceFields.contains(normalizedKey)) return;
      output[normalizedKey] = _stripTraceFields(item);
    });
    return output;
  }
  return value;
}

String buildCacheKeyMaterial(CacheKeyInput input) {
  final payloadJson = canonicalJsonStringify(_stripTraceFields(input.payload));
  return [
    input.namespace,
    input.operationId,
    payloadJson,
    input.schemaVersion,
    input.specChecksum,
    input.userScope,
  ].join('|');
}

String computeCacheKey(CacheKeyInput input, HashFn hashFn) {
  final material = buildCacheKeyMaterial(input);
  return hashFn(utf8.encode(material));
}
