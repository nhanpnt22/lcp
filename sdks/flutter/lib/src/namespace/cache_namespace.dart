class NamespaceScope {
  NamespaceScope({
    required this.cacheNamespace,
    required this.userScope,
  }) {
    if (cacheNamespace.trim().isEmpty) {
      throw ArgumentError.value(cacheNamespace, 'cacheNamespace', 'must be a non-empty string');
    }
    if (userScope.trim().isEmpty) {
      throw ArgumentError.value(userScope, 'userScope', 'must be a non-empty string');
    }
  }

  final String cacheNamespace;
  final String userScope;
}

NamespaceScope validateNamespaceScope(NamespaceScope scope) {
  return NamespaceScope(
    cacheNamespace: scope.cacheNamespace.trim(),
    userScope: scope.userScope.trim(),
  );
}

String buildIsolationPrefix(NamespaceScope scope) {
  final normalized = validateNamespaceScope(scope);
  return '${normalized.cacheNamespace}:${normalized.userScope}';
}

bool isNamespaceMatch(String metadataNamespace, String expectedNamespace) {
  if (metadataNamespace.isEmpty || expectedNamespace.isEmpty) {
    return false;
  }
  return metadataNamespace == expectedNamespace;
}

void assertNamespaceMatch(String metadataNamespace, String expectedNamespace) {
  if (!isNamespaceMatch(metadataNamespace, expectedNamespace)) {
    throw StateError('Namespace isolation violation: cache namespace mismatch');
  }
}
