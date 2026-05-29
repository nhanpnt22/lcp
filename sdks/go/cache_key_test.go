package lcp

import (
	"strings"
	"testing"
)

type tracePayload struct {
	UserID    string         `json:"userId"`
	TraceID   string         `json:"trace_id"`
	RequestID string         `json:"request_id"`
	Nested    nestedTraceBox `json:"nested"`
}

type nestedTraceBox struct {
	ActionID string `json:"action_id"`
	Safe     bool   `json:"safe"`
}

func TestBuildCacheKeyMaterialStripsTraceFields(t *testing.T) {
	input := CacheKeyInput{
		Namespace:     "profile",
		OperationID:   "get",
		SchemaVersion: "v1",
		SpecChecksum:  "spec",
		UserScope:     "u1",
		Payload: map[string]any{
			"userId":     "u1",
			"trace_id":   "t1",
			"request_id": "r1",
			"nested": map[string]any{
				"action_id": "a1",
				"safe":      true,
			},
		},
	}
	material, err := BuildCacheKeyMaterial(input)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if material == "" {
		t.Fatalf("material should not be empty")
	}
	if containsAny(material, "trace_id", "request_id", "action_id") {
		t.Fatalf("trace fields leaked into key material: %s", material)
	}
}

func TestBuildCacheKeyMaterialStripsTraceFieldsFromStructPayload(t *testing.T) {
	input := CacheKeyInput{
		Namespace:     "profile",
		OperationID:   "get",
		SchemaVersion: "v1",
		SpecChecksum:  "spec",
		UserScope:     "u1",
		Payload: tracePayload{
			UserID:    "u1",
			TraceID:   "t1",
			RequestID: "r1",
			Nested: nestedTraceBox{
				ActionID: "a1",
				Safe:     true,
			},
		},
	}
	material, err := BuildCacheKeyMaterial(input)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if containsAny(material, "trace_id", "request_id", "action_id") {
		t.Fatalf("trace fields leaked into key material: %s", material)
	}
}

func TestComputeCacheKeyRequiresHashFn(t *testing.T) {
	_, err := ComputeCacheKey(CacheKeyInput{
		Namespace:     "profile",
		OperationID:   "get",
		Payload:       map[string]any{"userId": "u1"},
		SchemaVersion: "v1",
		SpecChecksum:  "spec",
		UserScope:     "u1",
	}, nil)
	if err == nil || !strings.Contains(err.Error(), "hashFn is required") {
		t.Fatalf("expected missing hashFn error")
	}
}

func containsAny(s string, parts ...string) bool {
	for _, p := range parts {
		if len(p) > 0 && contains(s, p) {
			return true
		}
	}
	return false
}

func contains(s, sub string) bool {
	return len(sub) <= len(s) && (s == sub || (len(s) > 0 && (indexOf(s, sub) >= 0)))
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}
