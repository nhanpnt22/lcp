import '../entry/cache_entry.dart';

enum CacheFailureStage {
  memoryRead,
  memoryWrite,
  persistentRead,
  persistentWrite,
  validation,
  serialization,
}

enum CacheFailureAction {
  bypassToApi,
  returnStaleAndRefresh,
  hardFail,
}

class CacheFailureDecision<T> {
  const CacheFailureDecision({
    required this.action,
    required this.reason,
    this.staleEntry,
  });

  final CacheFailureAction action;
  final CacheEntry<T>? staleEntry;
  final String reason;
}

class CacheFailureInput<T> {
  const CacheFailureInput({
    required this.stage,
    required this.error,
    required this.allowStale,
    this.staleEntry,
    this.failClosed = false,
  });

  final CacheFailureStage stage;
  final Object error;
  final CacheEntry<T>? staleEntry;
  final bool allowStale;
  final bool failClosed;
}

enum FallbackSource { api, cache }

class FallbackExecutionResult<T> {
  const FallbackExecutionResult({
    required this.source,
    required this.value,
    required this.recovered,
    required this.reason,
  });

  final FallbackSource source;
  final T value;
  final bool recovered;
  final String reason;
}

String toFailureReason(Object error) {
  if (error is Error) {
    return error.toString();
  }
  if (error is Exception) {
    return error.toString();
  }
  return error.toString();
}

CacheFailureDecision<T> classifyCacheFailure<T>(CacheFailureInput<T> input) {
  final reason = '${input.stage.name}: ${toFailureReason(input.error)}';

  if (input.failClosed) {
    return CacheFailureDecision<T>(
      action: CacheFailureAction.hardFail,
      reason: reason,
    );
  }

  if (input.allowStale && input.staleEntry != null) {
    return CacheFailureDecision<T>(
      action: CacheFailureAction.returnStaleAndRefresh,
      staleEntry: input.staleEntry,
      reason: reason,
    );
  }

  return CacheFailureDecision<T>(
    action: CacheFailureAction.bypassToApi,
    reason: reason,
  );
}

Future<FallbackExecutionResult<T>> executeWithApiFallback<T>({
  required CacheFailureDecision<T> decision,
  required Future<T> Function() fetchFromApi,
}) async {
  switch (decision.action) {
    case CacheFailureAction.hardFail:
      throw StateError(decision.reason);
    case CacheFailureAction.returnStaleAndRefresh:
      final staleEntry = decision.staleEntry;
      if (staleEntry == null) {
        throw StateError(
            'Missing stale entry for returnStaleAndRefresh action');
      }
      return FallbackExecutionResult<T>(
        source: FallbackSource.cache,
        value: staleEntry.data,
        recovered: true,
        reason: decision.reason,
      );
    case CacheFailureAction.bypassToApi:
      final value = await fetchFromApi();
      return FallbackExecutionResult<T>(
        source: FallbackSource.api,
        value: value,
        recovered: true,
        reason: decision.reason,
      );
  }
}
