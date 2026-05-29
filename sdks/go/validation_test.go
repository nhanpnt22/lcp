package lcp

import "testing"

type sensitivePayload struct {
	ProfileID string `json:"profileId"`
	Token     string `json:"access_token"`
}

func TestContainsSensitiveFieldDetectsStructPayload(t *testing.T) {
	if !ContainsSensitiveField(sensitivePayload{ProfileID: "p1", Token: "secret"}) {
		t.Fatalf("expected access_token to be detected from struct payload")
	}
}

func TestContainsSensitiveFieldIgnoresSafeStructPayload(t *testing.T) {
	if ContainsSensitiveField(struct {
		ProfileID string `json:"profileId"`
		Name      string `json:"name"`
	}{
		ProfileID: "p1",
		Name:      "alice",
	}) {
		t.Fatalf("did not expect sensitive field detection for safe payload")
	}
}
