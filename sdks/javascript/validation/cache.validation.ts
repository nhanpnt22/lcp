import type { CacheEntry, CacheMetadataParityExpectation } from "../entry";
import { isCacheMetadataParityValid } from "../entry";
import { deterministicSerialize } from "../consistency";
import { stripTraceFields } from "../trace";

const SENSITIVE_FIELDS = new Set([
  "jwt",
  "access_token",
  "refresh_token",
  "authorization",
  "credentials",
  "user_id"
]);

const TRACE_FIELDS = new Set(["trace_id", "action_id", "request_id"]);

export interface CacheValidationContext {
  parity: CacheMetadataParityExpectation;
  expectedCacheKey?: string;
  requireNoSensitiveData?: boolean;
  requireNoTraceInData?: boolean;
}

export interface CacheValidationResult {
  ok: boolean;
  errors: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object") {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function findForbiddenFieldPaths(
  value: unknown,
  forbidden: Set<string>,
  path = "data"
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findForbiddenFieldPaths(item, forbidden, `${path}[${index}]`)
    );
  }

  if (!isPlainObject(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextPath = `${path}.${key}`;
    const violations = forbidden.has(key) ? [nextPath] : [];
    return violations.concat(findForbiddenFieldPaths(nested, forbidden, nextPath));
  });
}

function hasDeterministicSerialization(value: unknown): boolean {
  const first = deterministicSerialize(value);
  const second = deterministicSerialize(value);
  return first === second;
}

export function validateCacheEntryInvariants<T = unknown>(
  entry: CacheEntry<T>,
  context: CacheValidationContext
): CacheValidationResult {
  const errors: string[] = [];

  if (!entry?.cache_key?.trim()) {
    errors.push("cache_key must be a non-empty string");
  }

  if (context.expectedCacheKey && entry.cache_key !== context.expectedCacheKey) {
    errors.push("cache_key mismatch with expected identity");
  }

  if (!isCacheMetadataParityValid(entry.metadata, context.parity)) {
    errors.push("cache_metadata parity validation failed");
  }

  if (!hasDeterministicSerialization(entry.data)) {
    errors.push("deterministic serialization check failed");
  }

  if (context.requireNoSensitiveData) {
    const sensitivePaths = findForbiddenFieldPaths(entry.data, SENSITIVE_FIELDS);
    if (sensitivePaths.length > 0) {
      errors.push(`sensitive fields present: ${sensitivePaths.join(", ")}`);
    }
  }

  if (context.requireNoTraceInData) {
    const tracePaths = findForbiddenFieldPaths(entry.data, TRACE_FIELDS);
    if (tracePaths.length > 0) {
      errors.push(`trace fields persisted in data: ${tracePaths.join(", ")}`);
    }

    const stripped = stripTraceFields(entry.data);
    if (deterministicSerialize(stripped) !== deterministicSerialize(entry.data)) {
      errors.push("trace fields must not be persisted in cache data");
    }
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function assertCacheEntryInvariants<T = unknown>(
  entry: CacheEntry<T>,
  context: CacheValidationContext
): void {
  const result = validateCacheEntryInvariants(entry, context);
  if (!result.ok) {
    throw new Error(`Cache validation failed: ${result.errors.join("; ")}`);
  }
}
