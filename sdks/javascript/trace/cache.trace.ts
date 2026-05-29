const TRACE_FIELD_SET = new Set(["trace_id", "action_id", "request_id"]);

export interface TraceContext {
  trace_id: string;
  action_id: string;
  request_id: string;
}

function assertNonEmpty(value: string, field: keyof TraceContext): void {
  if (!value?.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Produces a validated immutable trace context for runtime propagation.
 */
export function createTraceContext(input: TraceContext): TraceContext {
  assertNonEmpty(input.trace_id, "trace_id");
  assertNonEmpty(input.action_id, "action_id");
  assertNonEmpty(input.request_id, "request_id");

  return Object.freeze({
    trace_id: input.trace_id,
    action_id: input.action_id,
    request_id: input.request_id
  });
}

/**
 * Returns a detached copy to guarantee unchanged propagation between layers.
 */
export function propagateTraceContext(context: TraceContext): TraceContext {
  return createTraceContext(context);
}

/**
 * Removes runtime trace fields from structures used in cache identity/persistence.
 */
export function stripTraceFields<T = unknown>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripTraceFields(item)) as T;
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value)) {
      if (TRACE_FIELD_SET.has(key)) {
        continue;
      }
      out[key] = stripTraceFields(raw);
    }
    return out as T;
  }

  return value;
}

/**
 * Verifies that trace values propagated through a path remained unchanged.
 */
export function isTraceContextEqual(expected: TraceContext, actual: TraceContext): boolean {
  return (
    expected.trace_id === actual.trace_id &&
    expected.action_id === actual.action_id &&
    expected.request_id === actual.request_id
  );
}

export function assertTraceContextEqual(expected: TraceContext, actual: TraceContext): void {
  if (!isTraceContextEqual(expected, actual)) {
    throw new Error("Trace context mismatch: trace_id/action_id/request_id must propagate unchanged");
  }
}
