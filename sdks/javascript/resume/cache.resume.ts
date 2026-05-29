import { deterministicSerialize } from "../consistency";
import type { H57HashFunction } from "../key";

const textEncoder = new TextEncoder();

export interface ResumeStateRecord {
  widget_id: string;
  state_version: number;
}

export type WidgetStateMap = Record<string, number>;

export interface ResumeStateStore {
  update(record: ResumeStateRecord): void;
  snapshot(): WidgetStateMap;
  clear(): void;
  size(): number;
}

export interface ResumeHint {
  widget_state_map: WidgetStateMap;
  resume_token?: string;
}

function assertNonEmpty(value: string, field: string): void {
  if (!value?.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function normalizeStateVersion(value: number): number {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    throw new TypeError("state_version must be a non-negative integer");
  }
  return value;
}

function canonicalizeWidgetStateMap(map: WidgetStateMap): WidgetStateMap {
  const out: WidgetStateMap = {};
  const keys = Object.keys(map).sort((a, b) => a.localeCompare(b));
  for (const key of keys) {
    assertNonEmpty(key, "widget_id");
    const value = map[key];
    out[key] = normalizeStateVersion(value);
  }
  return out;
}

export class InMemoryResumeStateStore implements ResumeStateStore {
  private readonly map = new Map<string, number>();

  update(record: ResumeStateRecord): void {
    assertNonEmpty(record.widget_id, "widget_id");
    const next = normalizeStateVersion(record.state_version);
    const current = this.map.get(record.widget_id);
    if (current === undefined || next > current) {
      this.map.set(record.widget_id, next);
    }
  }

  snapshot(): WidgetStateMap {
    const out: WidgetStateMap = {};
    const keys = Array.from(this.map.keys()).sort((a, b) => a.localeCompare(b));
    for (const key of keys) {
      const value = this.map.get(key);
      if (value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }

  clear(): void {
    this.map.clear();
  }

  size(): number {
    return this.map.size;
  }
}

/**
 * Deterministic token material aligned with H57(trace_id + widget_state_map).
 */
export function buildResumeTokenMaterial(traceId: string, widgetStateMap: WidgetStateMap): string {
  assertNonEmpty(traceId, "trace_id");
  const canonicalMap = canonicalizeWidgetStateMap(widgetStateMap);
  return `${traceId}|${deterministicSerialize(canonicalMap)}`;
}

export function buildResumeHint(input: {
  traceId: string;
  widgetStateMap: WidgetStateMap;
  h57Hash?: H57HashFunction;
}): ResumeHint {
  assertNonEmpty(input.traceId, "trace_id");
  const widgetStateMap = canonicalizeWidgetStateMap(input.widgetStateMap);
  if (!input.h57Hash) {
    return {
      widget_state_map: widgetStateMap
    };
  }

  const material = buildResumeTokenMaterial(input.traceId, widgetStateMap);
  const resumeToken = input.h57Hash(textEncoder.encode(material));

  return {
    widget_state_map: widgetStateMap,
    resume_token: resumeToken
  };
}
