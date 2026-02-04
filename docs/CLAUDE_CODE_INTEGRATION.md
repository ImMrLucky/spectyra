# Spectyra + Claude Code (Developer Integration Guide)

This document is a **copy/paste handoff** for developers who want to route Claude Code through Spectyra to get **before/after token savings** and to verify their requests are optimized end‑to‑end.

## What you need (keys + prerequisites)

- **Node.js 18+**
- **Spectyra API Key** (org/project key)
  - Used as `SPECTYRA_API_KEY`
- **Provider key**
  - For Claude / Anthropic: `ANTHROPIC_API_KEY`
- Optional: a Spectyra hosted URL (defaults shown below)

## Quick Start (fastest): use the local Spectyra Proxy

Claude Code can point at a custom API endpoint. The Spectyra proxy exposes an **OpenAI-compatible** endpoint and an **Anthropic-compatible** endpoint, and forwards requests to Spectyra which forwards to the provider.

### 1) Start the proxy

#### Option A — Run from this repo (recommended for dev)

```bash
cd tools/proxy
pnpm install

export SPECTYRA_API_URL="https://spectyra.up.railway.app/v1"
export SPECTYRA_API_KEY="sk_spectyra_..."
export ANTHROPIC_API_KEY="sk-ant-..."

# Mode: compare baseline vs optimized
export SPECTYRA_MODE="optimized"     # or "baseline"
export SPECTYRA_OPT_LEVEL="2"        # 0–4 (2–3 recommended)

pnpm start
```

The proxy listens on:

- `http://127.0.0.1:3001`

Health check:

```bash
curl http://localhost:3001/health
```

#### Option B — Install globally (for external devs)

```bash
npm install -g spectyra-proxy

export SPECTYRA_API_URL="https://spectyra.up.railway.app/v1"
export SPECTYRA_API_KEY="sk_spectyra_..."
export ANTHROPIC_API_KEY="sk-ant-..."
export SPECTYRA_MODE="optimized"
export SPECTYRA_OPT_LEVEL="2"

spectyra-proxy
```

### 2) Configure Claude Code

In Claude Code settings, set the **custom API endpoint/base URL** to:

- `http://localhost:3001/v1`

Then restart Claude Code.

### 3) Verify it’s working

1. Make a request in Claude Code (any normal prompt).
2. Confirm the proxy health works:

```bash
curl http://localhost:3001/health
```

3. Confirm Spectyra is receiving runs:
   - Open the Spectyra web app
   - Go to **Runs** / **Usage** (where you normally view activity)

## How to see savings locally (Baseline vs Optimized)

Many IDE tools don’t display token counts. The most reliable way to see savings is:

1) run the same request through the proxy twice:

- once with `SPECTYRA_MODE=baseline`
- once with `SPECTYRA_MODE=optimized`

2) compare the token usage reported in the response.

### Fast reproducible “before/after” test via curl (Anthropic-style)

Run this twice, only changing `SPECTYRA_MODE`.

```bash
export SPECTYRA_MODE="baseline"   # then repeat with "optimized"

curl -s http://localhost:3001/v1/messages \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-latest",
    "max_tokens": 256,
    "messages": [
      { "role": "user", "content": "Run the full test suite and paste output. Do not propose patches until you read the failing file." }
    ]
  }' | python - <<'PY'
import json,sys
d=json.load(sys.stdin)
u=d.get("usage",{})
print("input_tokens:",u.get("input_tokens"))
print("output_tokens:",u.get("output_tokens"))
PY
```

Expected:

- **Baseline** input_tokens is higher or equal
- **Optimized** input_tokens is lower (often materially lower for code flows)

### Fast reproducible “before/after” test via curl (OpenAI-style)

```bash
export SPECTYRA_MODE="baseline"   # then repeat with "optimized"

curl -s http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [
      { "role": "user", "content": "Summarize this request in 3 bullets and ask 1 clarifying question." }
    ]
  }' | python - <<'PY'
import json,sys
d=json.load(sys.stdin)
u=d.get("usage",{})
print("prompt_tokens:",u.get("prompt_tokens"))
print("completion_tokens:",u.get("completion_tokens"))
PY
```

## Common issues / troubleshooting

### Proxy says “SPECTYRA_API_KEY not set”

Set:

```bash
export SPECTYRA_API_KEY="sk_spectyra_..."
```

### Provider key not configured

For Anthropic:

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### 403 from Spectyra

- Your key may be invalid / revoked, or you don’t have access to the endpoint.
- Confirm the key works in the Spectyra app and that your org/project has access.

### Want to debug what’s being sent?

The proxy is intentionally conservative about logging prompts. If you need local debugging, you can run with:

```bash
export DEBUG_LOG_PROMPTS=true
```

Use with care (it may log prompt content locally).

---

## (Optional) Application integration (SDK)

If you’re integrating Spectyra into your own Node app (not Claude Code), use the SDK:

```ts
import { createSpectyra } from "@spectyra/sdk";

const spectyra = createSpectyra({
  mode: "api",
  endpoint: "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY,
});

const ctx = { runId: crypto.randomUUID(), budgetUsd: 2.5 };
const meta = { promptChars: 10000, path: "code", repoId: "my-repo", language: "typescript" };

const resp = await spectyra.agentOptionsRemote(ctx, meta);
// pass resp.options into your agent runtime
```

