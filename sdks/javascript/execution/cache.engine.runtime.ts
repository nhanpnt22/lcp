import type { ResumeStateRecord, ResumeStateStore } from "../resume";
import type { ReadThroughRequest } from "./cache.engine.types";

function extractStateRecord(value: unknown): ResumeStateRecord | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const record = value as { widget_id?: unknown; state_version?: unknown };
  if (typeof record.widget_id !== "string") {
    return undefined;
  }
  if (!Number.isInteger(record.state_version) || (record.state_version as number) < 0) {
    return undefined;
  }

  return {
    widget_id: record.widget_id,
    state_version: record.state_version as number
  };
}

export function shouldBypassForStateAlignment<T>(params: {
  data: T;
  request: ReadThroughRequest<T>;
  resumeStore?: ResumeStateStore;
}): boolean {
  const fromData = extractStateRecord(params.data);
  if (!fromData) {
    return false;
  }

  const knownFromStore = params.resumeStore?.snapshot()[fromData.widget_id];
  if (typeof knownFromStore === "number" && knownFromStore > fromData.state_version) {
    return true;
  }

  const knownFromRequest = params.request.resumeState;
  if (
    knownFromRequest?.widget_id === fromData.widget_id &&
    knownFromRequest.state_version > fromData.state_version
  ) {
    return true;
  }

  return false;
}

export function triggerBackgroundRefresh<T>(params: {
  request: ReadThroughRequest<T>;
  cacheKey: string;
}): void {
  if (!params.request.onBackgroundRefresh) {
    return;
  }

  queueMicrotask(() => {
    void params.request.onBackgroundRefresh?.({
      cacheKey: params.cacheKey,
      requestId: params.request.trace?.request_id
    });
  });
}

export function trackResumeState<T>(params: {
  source: "API" | "CACHE";
  data: T;
  cacheKey: string;
  request: ReadThroughRequest<T>;
  resumeStore?: ResumeStateStore;
  resolveResumeState?: (params: {
    source: "API" | "CACHE";
    data: T;
    cacheKey: string;
    request: ReadThroughRequest<T>;
  }) => ResumeStateRecord | undefined;
}): void {
  if (!params.resumeStore) {
    return;
  }

  try {
    if (params.request.resumeState) {
      params.resumeStore.update(params.request.resumeState);
      return;
    }

    const derived = params.resolveResumeState?.({
      source: params.source,
      data: params.data,
      cacheKey: params.cacheKey,
      request: params.request
    });

    if (derived) {
      params.resumeStore.update(derived);
    }
  } catch {
    // Resume hints are advisory and must not affect execution semantics.
  }
}
