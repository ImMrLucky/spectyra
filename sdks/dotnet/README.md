# Spectyra .NET SDK (`Spectyra.SDK`)

`SpectyraClient` posts to a **Spectyra local runtime** (`POST /v1/chat/run`). Provider API keys are **BYOK on the runtime process** — this package does not send your OpenAI secret to Spectyra’s cloud.

---

## Install

```bash
dotnet add package Spectyra.SDK
```

Or in a `.csproj`:

```xml
<PackageReference Include="Spectyra.SDK" Version="0.1.0" />
```

Targets **.NET 8**. No Git clone is required for normal use.

---

## BYOK and local-first

- **Runtime:** Set `SPECTYRA_RUNTIME_URL` (or pass a base URL to `SpectyraClient`) to your local runtime. Configure provider keys **on that server**.
- **Embedded:** Use `SpectyraFfi` / session APIs from the same package when you ship `libspectyra_ffi` — your host process still owns provider credentials.
- **Cloud:** Optional Spectyra API usage is for billing/telemetry aggregates, not proxying inference with your provider key.

---

## Hello world (runtime)

```csharp
using Spectyra;

await using var client = new SpectyraClient("http://127.0.0.1:4269");
var json = await client.RunChatRuntimeAsync(
    "openai",
    "gpt-4o-mini",
    new[] { new ChatMessage("user", "Hello!") });
Console.WriteLine(json);
```

---

## Runtime mode (reference)

`SpectyraClient` reads `SPECTYRA_RUNTIME_URL` when the constructor argument is null. `RunChatRuntimeAsync` returns the raw JSON string from the runtime.

---

## Embedded / session API (optional)

`SpectyraSession` + `SpectyraSdkConfiguration` support embedded FFI paths. See [RUST_AND_FFI_BUILD.md](https://github.com/spectyra/spectyra/blob/main/docs/sdk/RUST_AND_FFI_BUILD.md) and `SpectyraFfi.cs` in this repo.

---

## Contributing

**Clone this repository only if you are developing or modifying the .NET SDK.**

```bash
git clone https://github.com/spectyra/spectyra.git
cd spectyra/sdks/dotnet
dotnet build
dotnet test   # when test projects exist
```

Published consumers should use **`dotnet add package Spectyra.SDK`** from NuGet.

---

## More documentation

- [docs/sdk/README.md](https://github.com/spectyra/spectyra/blob/main/docs/sdk/README.md)
