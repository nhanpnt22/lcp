package lcp

import "testing"

func TestBuildResumeHintDeterministic(t *testing.T) {
	state := map[string]int64{"w2": 2, "w1": 1}
	hintA, err := BuildResumeHint("t1", state, H57HashFn)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	hintB, err := BuildResumeHint("t1", map[string]int64{"w1": 1, "w2": 2}, H57HashFn)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if hintA["resume_token"] != hintB["resume_token"] {
		t.Fatalf("expected deterministic token")
	}
}
