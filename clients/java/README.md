# Spectyra local runtime — Java integration

This pattern targets JVM services (Spring Boot, Micronaut, plain HTTP) calling the **Spectyra Rust localhost runtime** instead of embedding Node.

## Requirements

- **Spectyra runtime** reachable at `http://127.0.0.1:4269` (default bind).
- **BYOK**: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` configured for the runtime process (not your Java heap).
- Optional **`SPECTYRA_ACCOUNT_KEY`** so the runtime can refresh entitlements and pricing snapshots from Spectyra cloud **without ever receiving your prompts**.

## Mental model

```
Your Java code  →  HTTP POST /v1/chat/run  →  Local Spectyra runtime  →  Provider HTTPS API
```

Spectyra cloud only receives **identifiers + aggregates** when analytics is enabled — never prompts.

## Minimal flow

1. Build a camelCase JSON body (`RunChatRequest` in OpenAPI): `provider`, `model`, `messages[]`.
2. POST to `/v1/chat/run`.
3. Parse `output` as the provider-native payload (same shape as direct vendor calls).
4. Read **`savingsAmount`**, **`costBefore`**, **`costAfter`**, **`warnings`**, **`quotaStatus`** from the Spectyra envelope.

### Pseudocode (Java 17+ HttpClient)

```java
var body = """
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "messages": [
        {"role":"system","content":"You are concise."},
        {"role":"user","content":"Summarize BYOK."}
      ],
      "metadata": {
        "environment": "production",
        "projectId": "billing-service"
      }
    }""";

var req = HttpRequest.newBuilder(URI.create("http://127.0.0.1:4269/v1/chat/run"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();

var res = HttpClient.newHttpClient().send(req, HttpResponse.BodyHandlers.ofString());
// Parse JSON: read 'output' for provider payload; read savings + quotaStatus for Spectyra UX.
```

## Savings and quota UX

- **Savings**: use `savingsAmount` / `savingsPercent` per response; roll up with `GET /v1/metrics/session`.
- **Quota / pause**: inspect `quotaStatus.state` (`active_free`, `quota_exhausted`, `inactive_due_to_quota`, …). When the plan blocks optimization, the runtime still returns provider output if `passThroughWhenPaused` is enabled (default), but transforms may be skipped.

## Contract

See `runtime/contracts/openapi/spectyra-runtime.openapi.yaml` for exact field names.
