package lcp

import "strings"

func IsNamespaceValid(namespace string) bool {
	namespace = strings.TrimSpace(namespace)
	return namespace != "" && !strings.Contains(namespace, " ")
}

func IsNamespaceMatch(expected, actual string) bool {
	return strings.TrimSpace(expected) == strings.TrimSpace(actual)
}
