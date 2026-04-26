package spectyra

import "testing"

func TestNewSessionRuntimeDefault(t *testing.T) {
	s, err := NewSession(SessionConfig{})
	if err != nil {
		t.Fatal(err)
	}
	if s.mode != "runtime" || s.client == nil {
		t.Fatalf("expected runtime client, got mode=%q client=%v", s.mode, s.client)
	}
}

func TestNewSessionEmbeddedRequiresPath(t *testing.T) {
	t.Setenv("SPECTYRA_FFI_PATH", "")
	_, err := NewSession(SessionConfig{Mode: "embedded"})
	if err == nil {
		t.Fatal("expected error without FFI path")
	}
}
