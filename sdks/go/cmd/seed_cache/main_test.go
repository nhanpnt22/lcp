package main

import (
	"os"
	"testing"
)

func TestEnvOrReturnsFallbackWhenUnset(t *testing.T) {
	const key = "LCP_TEST_ENV_OR_UNSET"
	_ = os.Unsetenv(key)

	got := envOr(key, "fallback")
	if got != "fallback" {
		t.Fatalf("expected fallback, got %q", got)
	}
}

func TestEnvOrReturnsValueWhenSet(t *testing.T) {
	const key = "LCP_TEST_ENV_OR_SET"
	t.Setenv(key, "present")

	got := envOr(key, "fallback")
	if got != "present" {
		t.Fatalf("expected present value, got %q", got)
	}
}

func TestEnvInt64OrReturnsFallbackWhenUnset(t *testing.T) {
	const key = "LCP_TEST_ENV_INT64_UNSET"
	_ = os.Unsetenv(key)

	got := envInt64Or(key, 42)
	if got != 42 {
		t.Fatalf("expected fallback 42, got %d", got)
	}
}

func TestEnvInt64OrReturnsParsedValueWhenValid(t *testing.T) {
	const key = "LCP_TEST_ENV_INT64_VALID"
	t.Setenv(key, "12345")

	got := envInt64Or(key, 42)
	if got != 12345 {
		t.Fatalf("expected parsed value 12345, got %d", got)
	}
}

func TestEnvInt64OrReturnsFallbackWhenInvalid(t *testing.T) {
	const key = "LCP_TEST_ENV_INT64_INVALID"
	t.Setenv(key, "not-a-number")

	got := envInt64Or(key, 42)
	if got != 42 {
		t.Fatalf("expected fallback 42 on parse error, got %d", got)
	}
}
