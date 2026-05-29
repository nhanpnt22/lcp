import '../entry/cache_entry.dart';

abstract class PersistentCacheStore<T> {
  Future<CacheEntry<T>?> get(String cacheKey);

  Future<void> set(CacheEntry<T> entry);

  Future<void> delete(String cacheKey);

  Future<void> clear();

  Future<int> pruneExpired({required int now});

  Future<List<CacheEntry<T>>> hydrateAllValid({
    required int now,
    int? limit,
  });
}
