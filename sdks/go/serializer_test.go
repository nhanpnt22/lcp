package lcp

import "testing"

func TestCanonicalSerializeDeterministic(t *testing.T) {
	a, err := CanonicalSerialize(map[string]any{"b": 2, "a": 1})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	b, err := CanonicalSerialize(map[string]any{"a": 1, "b": 2})
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if string(a) != string(b) {
		t.Fatalf("expected canonical output match, got %s and %s", string(a), string(b))
	}
}
