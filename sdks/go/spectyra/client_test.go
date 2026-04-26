package spectyra

import "testing"

func TestNewClientDefaultBase(t *testing.T) {
	c := NewClient(Config{})
	if c.base == "" {
		t.Fatal("expected default base")
	}
}
