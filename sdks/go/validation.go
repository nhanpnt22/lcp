package lcp

import (
	"errors"
	"strings"
)

type ValidationOptions struct {
	Parity           CacheMetadataParityExpectation
	ExpectedCacheKey string
}

var ErrInvalidCacheEntry = errors.New("invalid cache entry invariants")

func AssertCacheEntryInvariants[T any](entry CacheEntry[T], opts ValidationOptions) error {
	if entry.CacheKey == "" || entry.CacheKey != opts.ExpectedCacheKey {
		return ErrInvalidCacheEntry
	}
	if !IsCacheMetadataParityValid(entry.Metadata, opts.Parity) {
		return ErrInvalidCacheEntry
	}
	if ContainsSensitiveField(entry.Data) {
		return ErrInvalidCacheEntry
	}
	return nil
}

func ContainsSensitiveField(value any) bool {
	sensitive := map[string]struct{}{
		"jwt":           {},
		"access_token":  {},
		"refresh_token": {},
		"authorization": {},
		"credentials":   {},
		"user_id":       {},
	}
	return containsSensitiveField(value, sensitive)
}

func containsSensitiveField(value any, sensitive map[string]struct{}) bool {
	switch v := normalizeTraversalValue(value).(type) {
	case map[string]any:
		for key, item := range v {
			if _, ok := sensitive[strings.ToLower(key)]; ok {
				return true
			}
			if containsSensitiveField(item, sensitive) {
				return true
			}
		}
	case []any:
		for _, item := range v {
			if containsSensitiveField(item, sensitive) {
				return true
			}
		}
	}
	return false
}
