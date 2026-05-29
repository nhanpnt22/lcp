export const OAC_TTL_HEADER = "x-oac-cache.ttl_ms";

export type TtlStatus = "VALID" | "EXPIRED" | "BYPASS";

export interface TtlEvaluationResult {
  status: TtlStatus;
  ttlMs?: number;
  expiresAt?: number;
}

function isHeadersLike(value: unknown): value is Headers {
  return typeof Headers !== "undefined" && value instanceof Headers;
}

function parseTtl(raw: string | null | undefined): number | undefined {
  if (raw == null || raw.trim() === "") {
    return undefined;
  }

  const ttl = Number(raw);
  if (!Number.isFinite(ttl) || ttl < 0 || !Number.isInteger(ttl)) {
    return undefined;
  }

  return ttl;
}

/**
 * Extracts OAC-authoritative TTL from transport headers.
 * Missing or invalid values intentionally return undefined (BYPASS semantics).
 */
export function extractOacTtlMs(
  headers: Headers | Record<string, string | undefined>
): number | undefined {
  if (isHeadersLike(headers)) {
    return parseTtl(headers.get(OAC_TTL_HEADER));
  }

  const direct = headers[OAC_TTL_HEADER];
  if (direct !== undefined) {
    return parseTtl(direct);
  }

  // Allow case-insensitive lookup for plain object header maps.
  const foundKey = Object.keys(headers).find(
    (k) => k.toLowerCase() === OAC_TTL_HEADER.toLowerCase()
  );
  return parseTtl(foundKey ? headers[foundKey] : undefined);
}

export function computeExpiresAt(createdAt: number, ttlMs: number): number {
  return createdAt + ttlMs;
}

/**
 * TTL evaluation follows LCP rule: missing TTL => BYPASS cache.
 */
export function evaluateTtl(params: {
  createdAt: number;
  now: number;
  ttlMs?: number;
}): TtlEvaluationResult {
  if (params.ttlMs === undefined) {
    return { status: "BYPASS" };
  }

  const expiresAt = computeExpiresAt(params.createdAt, params.ttlMs);
  if (params.now < expiresAt) {
    return {
      status: "VALID",
      ttlMs: params.ttlMs,
      expiresAt
    };
  }

  return {
    status: "EXPIRED",
    ttlMs: params.ttlMs,
    expiresAt
  };
}
