class CacheSingleFlight<T> {
  final Map<String, Future<T>> _inFlight = <String, Future<T>>{};

  Future<T> run(String key, Future<T> Function() action) {
    final existing = _inFlight[key];
    if (existing != null) return existing;

    final future = action().whenComplete(() {
      _inFlight.remove(key);
    });

    _inFlight[key] = future;
    return future;
  }

  int size() => _inFlight.length;
}
