package spectyra

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
)

// SessionConfig selects HTTP runtime vs embedded FFI (parity with Python/Java/.NET facades).
type SessionConfig struct {
	Mode string // "runtime" (default) or "embedded"

	RuntimeBaseURL string
	// FFILibPath is optional; when empty, SPECTYRA_FFI_PATH is used in embedded mode.
	FFILibPath string
}

// Session is the high-level entry: runtime HTTP or native pipeline + your provider.
type Session struct {
	mode       string
	client     *Client
	ffiLibPath string
}

func NewSession(cfg SessionConfig) (*Session, error) {
	mode := cfg.Mode
	if mode == "" {
		mode = "runtime"
	}
	switch mode {
	case "runtime":
		return &Session{
			mode:   mode,
			client: NewClient(Config{RuntimeBaseURL: cfg.RuntimeBaseURL}),
		}, nil
	case "embedded":
		p := cfg.FFILibPath
		if p == "" {
			p = os.Getenv("SPECTYRA_FFI_PATH")
		}
		if p == "" {
			return nil, errors.New("embedded mode requires FFILibPath or SPECTYRA_FFI_PATH")
		}
		return &Session{mode: mode, ffiLibPath: p}, nil
	default:
		return nil, fmt.Errorf("unknown session mode %q", mode)
	}
}

// RunChatRuntime POSTs /v1/chat/run (runtime mode only).
func (s *Session) RunChatRuntime(ctx context.Context, provider, model string, messages []Message) (json.RawMessage, error) {
	if s.mode != "runtime" || s.client == nil {
		return nil, errors.New("RunChatRuntime requires runtime mode")
	}
	return s.client.RunChatRuntime(ctx, provider, model, messages)
}

// ProviderCaller receives optimized messages from the pipeline; return the provider response body as JSON.
type ProviderCaller func(optimized []Message) (json.RawMessage, error)

// RunChat delegates to RunChatRuntime in runtime mode. In embedded mode, runs the FFI pipeline then callProvider.
func (s *Session) RunChat(
	ctx context.Context,
	provider, model string,
	messages []Message,
	entitlement json.RawMessage,
	sessionFrozen bool,
	callProvider ProviderCaller,
) (json.RawMessage, error) {
	if s.mode == "runtime" {
		return s.RunChatRuntime(ctx, provider, model, messages)
	}
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
	}
	if callProvider == nil {
		return nil, errors.New("embedded RunChat requires callProvider")
	}
	inner := map[string]any{
		"provider": provider,
		"model":    model,
		"messages": messages,
	}
	body := map[string]any{
		"request":        inner,
		"entitlement":    json.RawMessage(entitlement),
		"sessionFrozen": sessionFrozen,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	out, err := RunChatPipelineFFIJSON(s.ffiLibPath, raw)
	if err != nil {
		return nil, err
	}
	var pipe struct {
		Ok    bool            `json:"ok"`
		Error string          `json:"error"`
		Output json.RawMessage `json:"output"`
	}
	if err := json.Unmarshal(out, &pipe); err != nil {
		return nil, err
	}
	if !pipe.Ok {
		if pipe.Error == "" {
			pipe.Error = "pipeline error"
		}
		return nil, errors.New(pipe.Error)
	}
	var wrapped struct {
		Request struct {
			Messages []Message `json:"messages"`
		} `json:"request"`
	}
	if err := json.Unmarshal(pipe.Output, &wrapped); err != nil {
		return nil, err
	}
	return callProvider(wrapped.Request.Messages)
}
