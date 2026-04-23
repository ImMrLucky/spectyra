# BYOK, local-first architecture, and privacy

Spectyra’s non-Node runtime is designed so **customer environments stay authoritative** for inference data and provider credentials.

## What stays local

- **Prompts, completions, and full message arrays** for LLM calls made through the runtime.
- **Retrieved documents** and other RAG payloads you pass in requests.
- **Provider API keys** and any customer-side secret used to sign outbound provider HTTP calls.
- **Raw provider request/response bodies** used for application logic (surfaced in API responses to *your* app only).

The localhost HTTP API (`runtime/contracts/openapi/spectyra-runtime.openapi.yaml`) is intended to be reached from **trusted processes on the same machine** or a **locked-down sidecar** — not exposed on public interfaces without authentication and network policy.

## What may leave the local machine (Spectyra cloud control plane)

When you configure `SPECTYRA_ACCOUNT_KEY` and optional analytics, Spectyra cloud may receive **only**:

- Account / org / project / environment **identifiers** (when you embed them in metadata or Spectyra’s own headers).
- **Aggregated token and cost metrics**, savings estimates, and coarse latency summaries.
- **Quota tier / entitlement status / plan labels** from standard entitlement endpoints.
- **Pricing snapshot metadata** version and freshness (not customer prompts).
- **Runtime version** string for support and compatibility.

Prompt text, completions, embeddings inputs, retrieval chunks, and provider keys **must not** appear in these payloads.

## What provider keys are used for

`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (or overrides via runtime config env names) are read **only** on the host process to authenticate **direct HTTPS calls** from the runtime to the respective vendor APIs. They are **never** forwarded to Spectyra cloud.

## What the Spectyra account key is used for

`SPECTYRA_ACCOUNT_KEY` (machine / dashboard API key) authenticates **control-plane** requests such as:

- `GET /v1/entitlements/status`
- `GET /v1/pricing/snapshot`
- Optional `POST /v1/telemetry/run` with **aggregated** JSON matching the **same schema as the Node SDK** (`packages/sdk/src/cloud/postRunTelemetry.ts`): `environment`, `model`, `inputTokens`, `outputTokens`, `optimizedTokens`, `estimatedCost`, `optimizedCost`, `savings`, `diagnostics`, optional `project`

It is **not** used as a provider credential and **not** mixed into provider Authorization headers.

## Telemetry shaping and redaction

The Rust core builds analytics events **only** from explicit metrics types (`RunMetrics`, `SessionMetrics`, `AccountContext`) — never by serializing prompt-bearing structs. Automated tests assert serialized telemetry JSON does not include keys such as `messages`, `content`, `prompt`, `api_key`, or `authorization`.

## Why Spectyra is not an inference proxy

Optimization and provider HTTP calls execute **inside your environment**. Spectyra cloud does not terminate TLS to OpenAI, Anthropic, or Google on your behalf for application inference. Cloud endpoints provide **account state and economics metadata**, not a multi-tenant prompt router.

## Related documentation

- Runtime integration overview: `docs/runtime/README.md`
- HTTP contract: `runtime/contracts/openapi/spectyra-runtime.openapi.yaml`
