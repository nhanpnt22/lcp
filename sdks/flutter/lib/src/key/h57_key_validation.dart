import 'package:b57/b57.dart' as b57;

bool isH57CacheKey(String cacheKey) {
  final value = cacheKey.trim();
  if (value.isEmpty) {
    return false;
  }
  return b57.h57IsValid(value) && b57.h57IsCanonical(value);
}

String assertH57CacheKey(String cacheKey, String operation) {
  final value = cacheKey.trim();
  if (!isH57CacheKey(value)) {
    throw StateError(
        'invalid cache_key for $operation: expected canonical H57');
  }
  return value;
}
