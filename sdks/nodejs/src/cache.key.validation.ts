import { h57IsCanonical, h57IsValid } from "@aco/b57-js/h57.js";

export function isH57CacheKey(cacheKey: string): boolean {
  const value = cacheKey.trim();
  if (value.length === 0) {
    return false;
  }
  return h57IsValid(value) && h57IsCanonical(value);
}

export function assertH57CacheKey(cacheKey: string, operation: string): string {
  const value = cacheKey.trim();
  if (!isH57CacheKey(value)) {
    throw new Error(`invalid cache_key for ${operation}: expected canonical H57`);
  }
  return value;
}
