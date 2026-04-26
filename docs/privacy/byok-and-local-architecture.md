# BYOK and local architecture — what never leaves the host

## Principles

1. **Inference is local** — Spectyra optimization and the LLM **provider call** run in **your** process (Node SDK) or on **your** machine (future local runtime / sidecar).
2. **Bring your own keys (BYOK)** — OpenAI, Anthropic, and Groq keys are read from **your** environment or secret store. They are **not** sent to Spectyra.
3. **Spectyra cloud is control plane** — account, org, API keys for **Spectyra** (not the LLM provider), billing, quota, and **aggregated** usage for dashboards.

## What must **not** be sent to Spectyra

- Raw **prompts** or **completions**
- **Message arrays** or chat history
- **Documents** / RAG context bodies
- **Provider** API keys (OpenAI, Anthropic, Groq, etc.)

## What **may** be sent (when you opt in)

With `telemetry.mode: "cloud_redacted"` and a valid **Spectyra** API key + `SPECTYRA_API_BASE_URL` (base path including `/v1`):

- Account / org / project identifiers (as strings you pass, e.g. `runContext.project`)
- **Aggregated** token counts, cost estimates, savings, model and provider **names**
- **Quota / plan** state from `GET /v1/entitlements/status`
- SDK / runtime version and safe diagnostics (transform names, flow metrics that do not echo user text)

The Node SDK’s `POST /v1/telemetry/run` body is built in `packages/sdk/src/cloud/postRunTelemetry.ts` and is covered by **automated tests** that reject forbidden keys in the JSON payload.

## How savings are computed

- The **local** pipeline estimates **input** tokens before and after optimization and applies a **local or snapshot** pricing model to produce `estimatedCostBefore`, `estimatedCostAfter`, and derived savings.
- **Output** token costs are included in the report where applicable. Exact pricing comes from your configured model id and the platform’s non-secret pricing metadata — not from sending prompt text to the cloud.

## How to integrate

- **TypeScript / JavaScript (browser or Node):** `npm install @spectyra/sdk` — see `packages/sdk/README.md` and the `run()` API for callback-style usage.
- **Other languages:** call a **local** Node BFF or the **future** HTTP sidecar described in `docs/runtime/README.md` and `runtime/local-runtime/README.md`.

## OpenClaw

The **Local Companion** package is a separate, OpenClaw-oriented install. It also keeps provider traffic local; this document applies to the **in-app SDK** and **future** local runtime only.
