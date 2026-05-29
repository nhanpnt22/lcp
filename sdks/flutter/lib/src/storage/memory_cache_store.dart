import 'dart:collection';

import '../entry/cache_entry.dart';
import '../key/h57_key_validation.dart';

class MemoryCacheStore<T> {
  MemoryCacheStore({
    required this.maxEntries,
    int Function()? now,
  })  : assert(maxEntries > 0),
        _now = now ?? (() => DateTime.now().millisecondsSinceEpoch);

  final int maxEntries;
  final int Function() _now;
  final LinkedHashMap<String, CacheEntry<T>> _map = LinkedHashMap();

  CacheEntry<T>? get(String cacheKey) {
    final normalizedKey = assertH57CacheKey(cacheKey, 'memory.get');
    final entry = _map.remove(normalizedKey);
    if (entry == null) return null;
    if (_isExpired(entry)) return null;
    _map[normalizedKey] = entry;
    return entry;
  }

  CacheEntry<T>? peek(String cacheKey) {
    final normalizedKey = assertH57CacheKey(cacheKey, 'memory.peek');
    return _map[normalizedKey];
  }

  void set(CacheEntry<T> entry) {
    final normalizedKey = assertH57CacheKey(entry.cacheKey, 'memory.set');
    _map.remove(normalizedKey);
    _map[normalizedKey] = CacheEntry<T>(
      cacheKey: normalizedKey,
      data: entry.data,
      metadata: entry.metadata,
    );
    _evictIfNeeded();
  }

  bool delete(String cacheKey) {
    final normalizedKey = assertH57CacheKey(cacheKey, 'memory.delete');
    return _map.remove(normalizedKey) != null;
  }

  void clear() => _map.clear();

  int size() => _map.length;

  int pruneExpired() {
    final keys = _map.entries
        .where((entry) => _isExpired(entry.value))
        .map((entry) => entry.key)
        .toList(growable: false);
    for (final key in keys) {
      _map.remove(key);
    }
    return keys.length;
  }

  bool _isExpired(CacheEntry<T> entry) => _now() >= entry.metadata.expiresAt;

  void _evictIfNeeded() {
    if (_map.length <= maxEntries) return;

    final expiredKeys = <String>[];
    for (final item in _map.entries) {
      if (_isExpired(item.value)) expiredKeys.add(item.key);
    }

    for (final key in expiredKeys) {
      _map.remove(key);
      if (_map.length <= maxEntries) return;
    }

    while (_map.length > maxEntries) {
      _map.remove(_map.keys.first);
    }
  }
}
