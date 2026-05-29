package lcp

import (
	"errors"
	"strings"

	b57 "github.com/aco/f57"
)

type HashFn func([]byte) string

type CacheKeyInput struct {
	Namespace     string
	OperationID   string
	Payload       any
	SchemaVersion string
	SpecChecksum  string
	UserScope     string
}

var traceFields = map[string]struct{}{
	"trace_id":   {},
	"action_id":  {},
	"request_id": {},
}

var ErrHashFnRequired = errors.New("hashFn is required (use H57HashFn)")

func stripTraceFields(value any) any {
	switch v := normalizeTraversalValue(value).(type) {
	case []any:
		out := make([]any, len(v))
		for i, item := range v {
			out[i] = stripTraceFields(item)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(v))
		for key, item := range v {
			if _, ok := traceFields[key]; ok {
				continue
			}
			out[key] = stripTraceFields(item)
		}
		return out
	default:
		return value
	}
}

func BuildCacheKeyMaterial(input CacheKeyInput) (string, error) {
	payloadJSON, err := CanonicalJSONStringify(stripTraceFields(input.Payload))
	if err != nil {
		return "", err
	}
	parts := []string{
		input.Namespace,
		input.OperationID,
		payloadJSON,
		input.SchemaVersion,
		input.SpecChecksum,
		input.UserScope,
	}
	return strings.Join(parts, "|"), nil
}

func ComputeCacheKey(input CacheKeyInput, hashFn HashFn) (string, error) {
	material, err := BuildCacheKeyMaterial(input)
	if err != nil {
		return "", err
	}
	if hashFn == nil {
		return "", ErrHashFnRequired
	}
	return hashFn([]byte(material)), nil
}

func DefaultHashFn(bytes []byte) string {
	result, err := b57.H57Hash(bytes, b57.H57HashAuto)
	if err != nil {
		panic("H57Hash: " + err.Error())
	}
	return result
}

// H57HashFn is the canonical H57 hash hook: BLAKE3 → B57 encoding.
// Uses github.com/aco/f57 mapped to the F57 reference implementation.
func H57HashFn(bytes []byte) string {
	return DefaultHashFn(bytes)
}
