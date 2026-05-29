import 'dart:collection';

import '../entry/cache_entry.dart';

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
    final entry = _map.remove(cacheKey);
    if (entry == null) return null;
    if (_isExpired(entry)) return null;
    _map[cacheKey] = entry;
    return entry;
  }

  CacheEntry<T>? peek(String cacheKey) => _map[cacheKey];

  void set(CacheEntry<T> entry) {
    _map.remove(entry.cacheKey);
    _map[entry.cacheKey] = entry;
    _evictIfNeeded();
  }

  bool delete(String cacheKey) => _map.remove(cacheKey) != null;

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
