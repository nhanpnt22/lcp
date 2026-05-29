export interface NamespaceScope {
  cacheNamespace: string;
  userScope: string;
}

function assertNonEmpty(value: string, field: string): void {
  if (!value?.trim()) {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

/**
 * Validates namespace and user scope for strict tenant/app isolation.
 */
export function validateNamespaceScope(scope: NamespaceScope): NamespaceScope {
  assertNonEmpty(scope.cacheNamespace, "cacheNamespace");
  assertNonEmpty(scope.userScope, "userScope");

  return {
    cacheNamespace: scope.cacheNamespace.trim(),
    userScope: scope.userScope.trim()
  };
}

/**
 * Builds deterministic isolation prefix used by cache key composition.
 */
export function buildIsolationPrefix(scope: NamespaceScope): string {
  const normalized = validateNamespaceScope(scope);
  return `${normalized.cacheNamespace}:${normalized.userScope}`;
}

/**
 * Checks whether metadata namespace matches expected runtime namespace.
 */
export function isNamespaceMatch(
  metadataNamespace: string,
  expectedNamespace: string
): boolean {
  if (!metadataNamespace || !expectedNamespace) {
    return false;
  }
  return metadataNamespace === expectedNamespace;
}

/**
 * Runtime guard to block cross-namespace cache usage.
 */
export function assertNamespaceMatch(
  metadataNamespace: string,
  expectedNamespace: string
): void {
  if (!isNamespaceMatch(metadataNamespace, expectedNamespace)) {
    throw new Error("Namespace isolation violation: cache namespace mismatch");
  }
}
