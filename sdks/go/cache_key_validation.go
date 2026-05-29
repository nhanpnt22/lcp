package lcp

import (
	"fmt"
	"strings"

	b57 "github.com/aco/f57"
)

func validateH57CacheKey(cacheKey string, operation string) (string, error) {
	trimmed := strings.TrimSpace(cacheKey)
	if trimmed == "" {
		return "", fmt.Errorf("invalid cache_key for %s: empty", operation)
	}
	if !b57.H57IsValid(trimmed) || !b57.H57IsCanonical(trimmed) {
		return "", fmt.Errorf("invalid cache_key for %s: expected canonical H57", operation)
	}
	return trimmed, nil
}
