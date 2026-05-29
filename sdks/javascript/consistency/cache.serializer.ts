export type CanonicalValue =
  | null
  | boolean
  | number
  | string
  | CanonicalValue[]
  | { [k: string]: CanonicalValue };

function normalizeNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError("Non-finite numbers are not allowed in canonical JSON");
  }

  // Normalize -0 to 0 for stable cross-runtime output.
  return Object.is(value, -0) ? 0 : value;
}

function normalizeDate(value: Date): string {
  return value.toISOString();
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function canonicalize(value: unknown): CanonicalValue {
  if (value === null) {
    return null;
  }

  if (value instanceof Date) {
    return normalizeDate(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  switch (typeof value) {
    case "boolean":
      return value;
    case "number":
      return normalizeNumber(value);
    case "string":
      return value;
    case "undefined":
      // undefined is removed only when object properties are normalized.
      return null;
    case "object": {
      if (!isPlainObject(value)) {
        throw new TypeError("Only plain objects, arrays, primitives and Date are allowed");
      }

      const out: { [k: string]: CanonicalValue } = {};
      const keys = Object.keys(value).sort((a, b) => {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      });
      for (const key of keys) {
        const raw = value[key];
        if (raw === undefined) {
          continue;
        }
        out[key] = canonicalize(raw);
      }
      return out;
    }
    default:
      throw new TypeError("Unsupported value type in canonical JSON");
  }
}

/**
 * Shared deterministic serializer for cache_key material and persistence payloads.
 */
export function deterministicSerialize(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
