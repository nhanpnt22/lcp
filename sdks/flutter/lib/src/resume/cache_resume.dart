import 'dart:convert';

import '../key/cache_key.dart';
import '../key/canonical_json.dart';

class ResumeState {
  ResumeState({
    required this.widgetId,
    required this.stateVersion,
  }) {
    if (widgetId.trim().isEmpty) {
      throw ArgumentError.value(widgetId, 'widgetId', 'must be a non-empty string');
    }
    if (stateVersion < 0) {
      throw ArgumentError.value(stateVersion, 'stateVersion', 'must be a non-negative integer');
    }
  }

  final String widgetId;
  final int stateVersion;
}

class InMemoryResumeStateStore {
  final Map<String, int> _stateByWidget = <String, int>{};

  void update(ResumeState state) {
    final current = _stateByWidget[state.widgetId];
    if (current == null || state.stateVersion > current) {
      _stateByWidget[state.widgetId] = state.stateVersion;
    }
  }

  Map<String, int> snapshot() {
    final keys = _stateByWidget.keys.toList()..sort();
    return {for (final k in keys) k: _stateByWidget[k]!};
  }

  void clear() => _stateByWidget.clear();

  int size() => _stateByWidget.length;
}

Map<String, int> _canonicalizeWidgetStateMap(Map<String, int> widgetStateMap) {
  final keys = widgetStateMap.keys.toList()..sort();
  final canonical = <String, int>{};
  for (final key in keys) {
    if (key.trim().isEmpty) {
      throw ArgumentError.value(key, 'widgetStateMap key', 'must be a non-empty string');
    }
    final value = widgetStateMap[key]!;
    if (value < 0) {
      throw ArgumentError.value(value, 'widgetStateMap[$key]', 'must be a non-negative integer');
    }
    canonical[key] = value;
  }
  return canonical;
}

String buildResumeTokenMaterial({
  required String traceId,
  required Map<String, int> widgetStateMap,
}) {
  if (traceId.trim().isEmpty) {
    throw ArgumentError.value(traceId, 'traceId', 'must be a non-empty string');
  }
  final canonicalMap = _canonicalizeWidgetStateMap(widgetStateMap);
  return '$traceId|${canonicalJsonStringify(canonicalMap)}';
}

Map<String, Object> buildResumeHint({
  required String traceId,
  required Map<String, int> widgetStateMap,
  HashFn? hashFn,
}) {
  if (traceId.trim().isEmpty) {
    throw ArgumentError.value(traceId, 'traceId', 'must be a non-empty string');
  }
  final canonicalMap = _canonicalizeWidgetStateMap(widgetStateMap);
  final result = <String, Object>{
    'widget_state_map': canonicalMap,
  };
  if (hashFn != null) {
    final tokenMaterial = buildResumeTokenMaterial(
      traceId: traceId,
      widgetStateMap: canonicalMap,
    );
    result['resume_token'] = hashFn(utf8.encode(tokenMaterial));
  }
  return result;
}
