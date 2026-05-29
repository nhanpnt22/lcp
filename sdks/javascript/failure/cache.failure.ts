import type { CacheEntry } from "../entry";

export type CacheFailureStage =
  | "MEMORY_READ"
  | "MEMORY_WRITE"
  | "IDB_READ"
  | "IDB_WRITE"
  | "VALIDATION"
  | "SERIALIZATION";

export type CacheFailureAction = "BYPASS_TO_API" | "RETURN_STALE_AND_REFRESH" | "HARD_FAIL";

export interface CacheFailureDecision<T = unknown> {
  action: CacheFailureAction;
  staleEntry?: CacheEntry<T>;
  reason: string;
}

export interface CacheFailureInput<T = unknown> {
  stage: CacheFailureStage;
  error: unknown;
  staleEntry?: CacheEntry<T>;
  allowStale: boolean;
  failClosed?: boolean;
}

export interface FallbackExecutionResult<T = unknown> {
  source: "API" | "CACHE";
  value: T;
  recovered: boolean;
  reason: string;
}

export function toFailureReason(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Unknown cache failure";
    }
  }
  return "Unknown cache failure";
}

/**
 * Deterministic failure classifier for cache fallback policy.
 */
export function classifyCacheFailure<T = unknown>(
  input: CacheFailureInput<T>
): CacheFailureDecision<T> {
  const reason = `${input.stage}: ${toFailureReason(input.error)}`;

  if (input.failClosed) {
    return {
      action: "HARD_FAIL",
      reason
    };
  }

  if (input.allowStale && input.staleEntry) {
    return {
      action: "RETURN_STALE_AND_REFRESH",
      staleEntry: input.staleEntry,
      reason
    };
  }

  return {
    action: "BYPASS_TO_API",
    reason
  };
}

/**
 * Executes API fallback based on deterministic failure decision.
 */
export async function executeWithApiFallback<T>(params: {
  decision: CacheFailureDecision<T>;
  fetchFromApi: () => Promise<T>;
}): Promise<FallbackExecutionResult<T>> {
  if (params.decision.action === "HARD_FAIL") {
    throw new Error(params.decision.reason);
  }

  if (params.decision.action === "RETURN_STALE_AND_REFRESH") {
    if (!params.decision.staleEntry) {
      throw new Error("Missing stale entry for RETURN_STALE_AND_REFRESH action");
    }

    return {
      source: "CACHE",
      value: params.decision.staleEntry.data,
      recovered: true,
      reason: params.decision.reason
    };
  }

  const value = await params.fetchFromApi();
  return {
    source: "API",
    value,
    recovered: true,
    reason: params.decision.reason
  };
}
