final Set<String> _traceFields = {'trace_id', 'action_id', 'request_id'};

class TraceContext {
  TraceContext({
    required this.traceId,
    required this.actionId,
    required this.requestId,
  }) {
    if (traceId.trim().isEmpty) {
      throw ArgumentError.value(traceId, 'traceId', 'must be a non-empty string');
    }
    if (actionId.trim().isEmpty) {
      throw ArgumentError.value(actionId, 'actionId', 'must be a non-empty string');
    }
    if (requestId.trim().isEmpty) {
      throw ArgumentError.value(requestId, 'requestId', 'must be a non-empty string');
    }
  }

  final String traceId;
  final String actionId;
  final String requestId;
}

TraceContext createTraceContext(TraceContext input) {
  return TraceContext(
    traceId: input.traceId,
    actionId: input.actionId,
    requestId: input.requestId,
  );
}

TraceContext propagateTraceContext(TraceContext context) {
  return createTraceContext(context);
}

T stripTraceFields<T>(T value) {
  final stripped = _strip(value);
  return stripped as T;
}

Object? _strip(Object? value) {
  if (value is List) {
    final items = value.map(_strip).toList(growable: false);
    final hasNull = items.any((item) => item == null);
    if (hasNull) {
      return items.cast<Object?>();
    }
    return items.cast<Object>();
  }

  if (value is Map) {
    final out = <String, Object?>{};
    value.forEach((key, raw) {
      final keyText = key.toString();
      if (_traceFields.contains(keyText)) {
        return;
      }
      out[keyText] = _strip(raw);
    });

    final hasNull = out.values.any((item) => item == null);
    if (hasNull) {
      return out;
    }

    final nonNull = <String, Object>{};
    out.forEach((key, raw) {
      nonNull[key] = raw!;
    });
    return nonNull;
  }

  return value;
}

bool isTraceContextEqual(TraceContext expected, TraceContext actual) {
  return expected.traceId == actual.traceId &&
      expected.actionId == actual.actionId &&
      expected.requestId == actual.requestId;
}

void assertTraceContextEqual(TraceContext expected, TraceContext actual) {
  if (!isTraceContextEqual(expected, actual)) {
    throw StateError('Trace context mismatch: trace_id/action_id/request_id must propagate unchanged');
  }
}
