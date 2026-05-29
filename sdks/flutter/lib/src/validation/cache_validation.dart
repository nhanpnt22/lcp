import '../entry/cache_entry.dart';
import '../key/canonical_json.dart';
import '../key/h57_key_validation.dart';

class ValidationResult {
  const ValidationResult({
    required this.ok,
    required this.errors,
  });

  final bool ok;
  final List<String> errors;
}

class ValidationOptions {
  const ValidationOptions({
    required this.parity,
    this.expectedCacheKey,
    this.requireNoSensitiveData = true,
    this.requireNoTraceInData = true,
  });

  final CacheMetadataParityExpectation parity;
  final String? expectedCacheKey;
  final bool requireNoSensitiveData;
  final bool requireNoTraceInData;
}

const _sensitiveFields = <String>{
  'jwt',
  'access_token',
  'refresh_token',
  'authorization',
  'credentials',
  'user_id',
};

const _traceFields = <String>{'trace_id', 'action_id', 'request_id'};

ValidationResult validateCacheEntryInvariants<T>(
  CacheEntry<T> entry,
  ValidationOptions options,
) {
  final errors = <String>[];

  if (entry.cacheKey.trim().isEmpty) {
    errors.add('cache_key must be a non-empty string');
  }
  if (entry.cacheKey.trim().isNotEmpty && !isH57CacheKey(entry.cacheKey)) {
    errors.add('cache_key must be canonical H57');
  }
  if (options.expectedCacheKey != null &&
      entry.cacheKey != options.expectedCacheKey) {
    errors.add('cache_key mismatch with expected identity');
  }
  if (!isCacheMetadataParityValid(entry.metadata, options.parity)) {
    errors.add('cache_metadata parity validation failed');
  }

  final serialized = canonicalJsonStringify(entry.data);
  if (serialized != canonicalJsonStringify(entry.data)) {
    errors.add('deterministic serialization check failed');
  }

  if (options.requireNoSensitiveData) {
    final sensitivePaths = _findForbiddenPaths(entry.data, _sensitiveFields);
    if (sensitivePaths.isNotEmpty) {
      errors.add('sensitive fields present: ${sensitivePaths.join(', ')}');
    }
  }

  if (options.requireNoTraceInData) {
    final tracePaths = _findForbiddenPaths(entry.data, _traceFields);
    if (tracePaths.isNotEmpty) {
      errors.add('trace fields persisted in data: ${tracePaths.join(', ')}');
    }
  }

  return ValidationResult(ok: errors.isEmpty, errors: errors);
}

void assertCacheEntryInvariants<T>(
    CacheEntry<T> entry, ValidationOptions options) {
  final result = validateCacheEntryInvariants(entry, options);
  if (!result.ok) {
    throw StateError('Cache validation failed: ${result.errors.join('; ')}');
  }
}

List<String> _findForbiddenPaths(Object? value, Set<String> forbidden,
    [String root = 'data']) {
  if (value is List) {
    final out = <String>[];
    for (var i = 0; i < value.length; i++) {
      out.addAll(_findForbiddenPaths(value[i], forbidden, '$root[$i]'));
    }
    return out;
  }

  if (value is Map) {
    final out = <String>[];
    value.forEach((key, item) {
      final keyText = key.toString();
      final path = '$root.$keyText';
      if (forbidden.contains(keyText)) {
        out.add(path);
      }
      out.addAll(_findForbiddenPaths(item, forbidden, path));
    });
    return out;
  }

  return const <String>[];
}
