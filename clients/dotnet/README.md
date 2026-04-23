# Spectyra local runtime — .NET integration

Use this when your stack is **ASP.NET Core**, **Worker services**, or **Unity / native tooling on Windows** that can issue HTTP calls to a sidecar.

## Requirements

- Runtime listening on **`http://127.0.0.1:4269`** (or your configured bind).
- Provider keys supplied to the **runtime process environment** (BYOK).
- Optional Spectyra **`SPECTYRA_ACCOUNT_KEY`** on the runtime for control-plane refresh only.

## Flow

```
.NET app  →  HttpClient POST /v1/chat/run  →  Spectyra runtime  →  Provider REST API
```

No prompts are sent to Spectyra cloud by the runtime; optional telemetry carries **aggregates only**.

## Example shape

Use **`System.Net.Http.Json`** or **`HttpClient`** with camelCase JSON identical to the OpenAPI spec (`RunChatRequest`).

### Pseudocode (C# / .NET 8)

```csharp
using var http = new HttpClient { BaseAddress = new Uri("http://127.0.0.1:4269/") };

var payload = new {
    provider = "openai",
    model = "gpt-4o-mini",
    messages = new[] {
        new { role = "system", content = "You are concise." },
        new { role = "user", content = "Explain BYOK savings." }
    },
    metadata = new { environment = "production", projectId = "ledger-api" }
};

var res = await http.PostAsJsonAsync("v1/chat/run", payload);
var json = await res.Content.ReadAsStringAsync();
// Deserialize to a DTO with:
// - `output` (JsonElement / JsonNode) for provider payload
// - doubles for costBefore / costAfter / savingsAmount
// - quotaStatus.state for UI banners
```

## Savings + quota

- Show **per-call savings** from the response envelope.
- Poll **`GET /v1/metrics/session`** for cumulative totals while the runtime process stays up.
- Map **`quotaStatus.state`** to in-app banners; when optimization is paused, explain that Spectyra transforms may be off while provider traffic continues (passthrough).

## Reference

OpenAPI: `runtime/contracts/openapi/spectyra-runtime.openapi.yaml`.
