# Spectyra .NET SDK

Scaffold for C# backends. See [../../docs/sdk/README.md](../../docs/sdk/README.md).

## Build

```bash
cd sdks/dotnet && dotnet build
```

## Runtime mode

`SpectyraClient.RunChatRuntimeAsync` posts JSON to `{SPECTYRA_RUNTIME_URL}/v1/chat/run`. Provider API keys must be configured on the **Spectyra local runtime**.

## High-level API (runtime + embedded)

`SpectyraSession` + `SpectyraSdkConfiguration` mirror the Python `Spectyra` / Java entrypoint: **runtime** uses `SpectyraClient`; **embedded** loads `SpectyraFfi` and runs `spectyra_run_chat_pipeline_json`, then your async `callProvider` with optimized messages.

```csharp
await using var s = new SpectyraSession(SpectyraSdkConfiguration.EmbeddedDefaults("/path/to/libspectyra_ffi.dylib"));
var env = JsonNode.Parse("""{"plan":"trial"}""")!.AsObject();
var reply = await s.RunChatAsync(
    "openai", "gpt-4o-mini", new[] { new ChatMessage("user", "hi") },
    env, sessionFrozen: false,
    msgs => Task.FromResult(JsonNode.Parse("""{"choices":[]}""")!));
```

## Embedded (low-level)

`SpectyraFfi.Load` + `RunChatPipelineJson` — same contract as other language SDKs; see [../../docs/sdk/RUST_AND_FFI_BUILD.md](../../docs/sdk/RUST_AND_FFI_BUILD.md).
