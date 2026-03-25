# Spectyra — Local-First LLM Cost Optimization

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Spectyra reduces LLM token usage and cost **without proxying your data**.
Optimization runs locally — your prompts, responses, and provider keys never
leave your environment unless you explicitly opt in.

**Open source** under the **MIT License**. See [`LICENSE`](./LICENSE).

---

## How It Works

1. **Your app calls the LLM provider directly** — Spectyra never sits in the
   inference path by default.
2. **Before the call**, the SDK (or Local Companion) applies lightweight,
   local optimizations to your messages (whitespace normalization, deduplication,
   context window trimming).
3. **After the call**, a local `SavingsReport` tells you exactly what was saved.
4. **Optionally**, redacted analytics can be synced to the Spectyra cloud
   dashboard (off by default).

```
┌─────────────┐    direct    ┌─────────────────┐
│  Your Code  │ ──────────── │  LLM Provider   │
│  + Spectyra │              │  (OpenAI, etc.)  │
│    SDK      │              └─────────────────┘
└─────┬───────┘
      │ local analytics
      ▼
┌─────────────┐   opt-in    ┌─────────────────┐
│  Local      │ ──────────► │  Spectyra Cloud  │
│  Storage    │  (redacted)  │  Dashboard       │
└─────────────┘              └─────────────────┘
```

---

## Quick Start

```bash
pnpm install
pnpm dev        # starts API + Angular UI in parallel
```

Open http://localhost:4200.

---

## Integration Options

| Path | Code Changes? | Prompts Leave Your Machine? | Best For |
|------|---------------|-----------------------------|----------|
| **Desktop App / Local Companion** | None | No | Non-developers, OpenClaw |
| **SDK Wrapper** | Minimal | No | Developers building LLM apps |
| **Observe / Preview** | None | No | Evaluating savings (dry-run) |

### SDK (recommended for developers)

```bash
npm install @spectyra/sdk
```

```ts
import { createSpectyra } from "@spectyra/sdk";
import { createOpenAIAdapter } from "@spectyra/sdk/adapters/openai";
import OpenAI from "openai";

const spectyra = createSpectyra({ runMode: "on" });
const openai = new OpenAI();

const result = await spectyra.complete(
  {
    client: openai,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello" }],
  },
  createOpenAIAdapter(openai)
);

console.log(result.savingsReport);
```

### Local Companion (no code changes)

```bash
npx @spectyra/local-companion
# Starts on http://127.0.0.1:4111
```

Any app that lets you set a custom API base URL can use the Companion.
In your LLM app's settings, change the API endpoint to:

```
http://127.0.0.1:4111/v1
```

For example, if you use OpenAI's library or a tool like OpenClaw, set the
environment variable:

```bash
export OPENAI_BASE_URL=http://127.0.0.1:4111/v1
```

The Companion intercepts the request, optimizes it locally, then forwards it
directly to your provider using your API key.

### Desktop App

The Desktop App wraps the Local Companion in an Electron GUI with built-in
provider key management, license activation, and a local analytics dashboard.

```bash
cd apps/desktop
pnpm install
pnpm dev          # run in development
pnpm make         # build distributable (DMG, zip, or Squirrel installer)
```

The built app appears in `apps/desktop/out/`. It embeds the companion server
in-process — no separate install needed.

---

## Universal Mode Model

Every Spectyra surface (SDK, Companion, Desktop App, Web) uses the same
three-state mode:

| Mode | What Happens | Provider Call | Cost |
|------|-------------|---------------|------|
| `off` | Pass-through, minimal analytics | Direct | Full provider price |
| `observe` | Local dry-run, projected savings | **None** | Free |
| `on` | Optimization applied, then direct call | Direct | Reduced provider price |

Default for new integrations: **`observe`** (safe onboarding, no mutation).

---

## Architecture

```
packages/
  core-types/    — Shared types: modes, reports, security labels, entitlements
  sdk/           — @spectyra/sdk — SDK for in-code integration
  spectyra-agents/ — @spectyra/agents — Agent framework wrappers
  shared/        — Legacy shared types (being migrated to core-types)

apps/
  api/           — Express backend (dashboard APIs, billing, audit)
  web/           — Angular frontend (Studio, Observe, Integrations, Usage)
  desktop/       — Electron desktop app (bundles Local Companion)

tools/
  local-companion/ — Standalone OpenAI/Anthropic-compatible local server
  proxy/           — Local proxy for IDE tools (Cursor, Claude Code)
  cli/             — CLI wrapper
```

---

## Security Posture

| Concern | Default |
|---------|---------|
| Inference path | **Direct to provider** (never proxied through Spectyra) |
| Provider keys | **Customer-owned** (BYOK) |
| Prompt storage | **Local only** |
| Telemetry | **Local** (cloud sync is opt-in, redacted) |
| Billing for LLM usage | **Customer's provider account** |

See [SECURITY.md](SECURITY.md) and [docs/ENTERPRISE_SECURITY.md](docs/ENTERPRISE_SECURITY.md).

---

## Features

- **Multi-provider**: OpenAI, Anthropic, Groq (more coming)
- **Spectyra Studio**: Scenario-based comparison (dry-run + live BYOK)
- **Observe Mode**: Dry-run optimization with before/after prompt views
- **SavingsReport**: Structured JSON showing before/after tokens, cost, techniques applied
- **Entitlement model**: Free tier with generous limits, observe always free
- **License keys**: Offline-capable validation for Desktop App / Companion
- **Audit logging**: Complete trail for all security events
- **Enterprise controls**: RBAC, domain allowlists, SSO enforcement, data retention

---

## Quick Links

- [SDK Documentation](packages/sdk/README.md)
- [User Guide](docs/USER_GUIDE.md)
- [Integrations Page](apps/web/src/app/features/integrations/)
- [Security](SECURITY.md)

---

## License

MIT
