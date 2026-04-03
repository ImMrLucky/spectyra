# OpenClaw and Spectyra Local Companion (local-first)

## Request path

```
OpenClaw  →  Spectyra Local Companion (localhost, e.g. :4111)  →  your AI provider
```

- **Prompt traffic** is optimized inside the Local Companion process and sent **directly** to the user’s provider (OpenAI, Anthropic, Groq, etc.) using **local** API keys.
- **Spectyra cloud is not** on the inference path. Cloud may be used only for optional account/licensing, updates, or opt-in aggregate analytics.

## Responsibilities

| Layer | Role |
|--------|------|
| **`@spectyra/openclaw-bridge`** | Thin adapter: generate OpenClaw config JSON, localhost health/models probes, install copy, optional session metadata headers. **No** optimization, **no** provider keys, **no** cloud relay. |
| **Local Companion** (`tools/local-companion`) | Single local **optimization runtime**: normalize requests, run off/observe/on modes, workflow policy gate, forward to provider, normalize responses, emit local analytics. |
| **Other agents** (future) | Same Companion HTTP surface (`/v1/chat/completions`, `/v1/messages`) — OpenClaw is one integration among many. |

## Diagnostics

- `GET /health` — process status, run mode, provider configured (boolean), license flags (no secrets).
- `GET /v1/models` — OpenAI-style list including `spectyra/smart`, `spectyra/fast`, `spectyra/quality`.
- `GET /v1/diagnostics/integration` — safe structured metadata for setup UIs.
- `GET /diagnostics/status` — onboarding-oriented snapshot (`companionRunning`, `providerConfigured`, `mode`, `companionBaseUrl`, `modelAliases`, optional desktop/signed-in hints via env when desktop-managed).
- `GET /diagnostics/integrations/openclaw` — OpenClaw-specific flags (`detected`, `connected`, `lastSeenRequestAt`) derived from local traffic headers (no secrets).

## Running locally

```bash
pnpm --filter @spectyra/local-companion start
# Set OPENAI_API_KEY or ANTHROPIC_API_KEY / GROQ_API_KEY in the environment
curl -s http://127.0.0.1:4111/health | jq .
curl -s http://127.0.0.1:4111/v1/models | jq .
```

Configure OpenClaw with the JSON from `@spectyra/openclaw-bridge` (`generateOpenClawConfigString`) or the example in `@spectyra/integration-metadata` (`OPENCLAW_CONFIG_JSON`), with `baseUrl` pointing at `http://127.0.0.1:4111/v1` (or your resolved port).
