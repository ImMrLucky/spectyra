# Spectyra runtime & SDK — platform overview

Spectyra uses a **two-plane** model:

| Plane | Role | Data |
|--------|------|------|
| **Data** | Optimization + LLM calls | Stays **local** (your server or device). BYOK. |
| **Control** | Auth, billing, quota, aggregated analytics | Spectyra **cloud** — no prompt bodies. |

## Node / TypeScript — `@spectyra/sdk`

The primary in-app integration is the npm package **`@spectyra/sdk`**:

- `createSpectyra()` → `complete()` or `run()` with your OpenAI / Anthropic / Groq client.
- Optimization runs **in-process**; provider keys stay in your environment.
- Optional `telemetry.mode: "cloud_redacted"` sends **aggregated** usage to `POST /v1/telemetry/run` (see privacy doc).

See `packages/sdk/README.md`.

## Non-Node backends (Java, .NET, Go, …)

There is **no** native JVM or .NET Spectyra library yet. Supported patterns:

1. **Sidecar (planned)** — run the **local runtime** on `127.0.0.1:4269` and call it from your app (HTTP). Contract: `runtime/contracts/openapi/spectyra-runtime.yaml`.
2. **Node microservice** — a small internal service using `@spectyra/sdk`; your main stack calls it over gRPC/HTTP.

Both keep prompts and provider keys on **your** infrastructure.

## Rust core

`runtime/core-rust/` holds shared types and (future) pipeline code. **Request** structures may contain prompts for local work; **telemetry** structs must only contain aggregates safe for the control plane.

## OpenClaw

OpenClaw users use **`@spectyra/local-companion`** (separate product). It is not required for the in-app SDK.

## Further reading

- [../privacy/byok-and-local-architecture.md](../privacy/byok-and-local-architecture.md)
