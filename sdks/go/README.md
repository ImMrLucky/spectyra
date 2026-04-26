# Spectyra Go SDK (`github.com/spectyra/spectyra-go`)

Scaffold for Go backends. See [../../docs/sdk/README.md](../../docs/sdk/README.md).

## Runtime mode

```go
c := spectyra.NewClient(spectyra.Config{RuntimeBaseURL: "http://127.0.0.1:4269"})
env, err := c.RunChatRuntime(ctx, "openai", "gpt-4o-mini", []spectyra.Message{{Role: "user", Content: "hi"}})
```

Provider keys must live on the **Spectyra local runtime** process.

## High-level session (runtime + embedded)

```go
s, err := spectyra.NewSession(spectyra.SessionConfig{Mode: "embedded", FFILibPath: "/path/to/libspectyra_ffi.so"})
// entitlement: JSON object matching the pipeline contract (see TS/Python SDKs).
raw, err := s.RunChat(ctx, "openai", "gpt-4o-mini", msgs, entitlementJSON, false, func(opt []spectyra.Message) (json.RawMessage, error) {
    return json.RawMessage(`{}`), nil
})
```

## Embedded (low-level)

`RunChatPipelineFFIJSON(libPath, inputJSON)` — **linux/amd64 + CGO** loads the `.so` via `dlopen`; other platforms return `ErrFFIUnavailable`. See [../../docs/sdk/RUST_AND_FFI_BUILD.md](../../docs/sdk/RUST_AND_FFI_BUILD.md).
