# Spectyra Local Companion

**OpenAI-compatible HTTP server** on your machine. Optimizes prompts **before** they go to OpenAI, Anthropic-compatible clients, OpenClaw, Claude Code, or anything that lets you set a **custom API base URL**.

No changes to your application code — only configuration (environment variables or UI).

---

## Who this is for

- **OpenClaw** and similar agents that support a custom OpenAI endpoint  
- **Claude Code** / tools that proxy through an OpenAI-compatible URL  
- Developers who prefer a **terminal + localhost** over the [Desktop app](../../apps/desktop) GUI  

---

## Requirements

- **Node.js 18+**

---

## Install & run

### From npm (when published)

```bash
npx @spectyra/local-companion
```

Or install globally:

```bash
npm install -g @spectyra/local-companion
spectyra-companion
```

### From this monorepo (developers)

```bash
# From repository root
pnpm install
pnpm --filter @spectyra/local-companion start
```

Or:

```bash
cd tools/local-companion
pnpm install
pnpm start
```

---

## Configure your client

1. **Start the companion** — default listen address: `http://127.0.0.1:4111`

2. **Point your tool at the companion** (OpenAI-compatible):

   ```bash
   export OPENAI_BASE_URL=http://127.0.0.1:4111/v1
   ```

   Many tools also have a **Settings → API URL** or **Custom endpoint** field — use:

   `http://127.0.0.1:4111/v1`

3. **Keep your provider API key** in the client (OpenAI, Groq, etc.). The companion uses it to forward requests **directly** to the provider after optimization.

---

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Status, mode, inference path |
| GET | `/config` | Companion configuration (includes `provider`, `aliasSmartModel`, `aliasFastModel`) |
| GET | `/v1/models` | OpenAI-style model list (`spectyra/smart`, `spectyra/fast` for OpenClaw) |
| POST | `/v1/chat/completions` | OpenAI-compatible chat |
| POST | `/v1/messages` | Anthropic-compatible messages |
| GET | `/v1/analytics/live-events` | SSE stream of normalized `SpectyraEvent` (local) |
| GET | `/v1/analytics/live-state` | JSON snapshot for dashboards |
| GET | `/v1/analytics/events/recent` | Tail of `events.jsonl` (telemetry not off) |
| GET | `/v1/analytics/execution-graph/summary` | Phase 3 — graph + step scores from in-memory events |
| GET | `/v1/analytics/state-delta/summary` | Phase 4 — state/delta stats from in-memory events |
| GET | `/v1/analytics/workflow-policy/summary` | Phase 6 — workflow policy (same mode as pre-provider gate; default enforce) |
| GET | `/v1/analytics/current-session` | Current workflow session |
| GET | `/v1/analytics/sessions` | Recent sessions |
| GET | `/v1/analytics/session/:sessionId` | Session detail |
| GET | `/v1/analytics/prompt-comparison/:runId` | Prompt comparison metadata |
| POST | `/v1/analytics/session/complete` | Finalize active session |
| POST | `/v1/analytics/sync` | Sync intent ack (cloud upload via Spectyra app) |
| POST | `/v1/analytics/ingest` | Push adapter-shaped JSON (JSONL tailers, daemons, sidecars) |

See [AGENTIC_AND_SERVER_INTEGRATION.md](../../docs/AGENTIC_AND_SERVER_INTEGRATION.md) for OpenClaw, Claude harnesses, and server-side daemon patterns.

### Stable model aliases (`spectyra/smart`, `spectyra/fast`)

Configure the upstream provider with **`SPECTYRA_PROVIDER`** (`openai` | `anthropic` | `groq`). Optional overrides:

- **`SPECTYRA_ALIAS_SMART_MODEL`** — real model id for `spectyra/smart`
- **`SPECTYRA_ALIAS_FAST_MODEL`** — real model id for `spectyra/fast`

If unset, defaults match the chosen provider (see `@spectyra/shared` `defaultAliasModels`). OpenClaw and other clients can keep a fixed config pointing at `http://127.0.0.1:4111/v1` while you change routing in Spectyra Desktop or env vars.

---

## Modes

Spectyra uses a universal **off / observe / on** model:

- **off** — pass-through  
- **observe** — measure savings without changing what the model receives (good for trials)  
- **on** — apply optimizations (requires a valid license where enforced)  

Configure via companion API or match the [Desktop app](../../apps/desktop) behavior — see project docs.

**Environment (common):**

| Variable | Effect |
|----------|--------|
| `SPECTYRA_RUN_MODE` | `off` \| `observe` \| `on` — default **`on`** when unset |
| `SPECTYRA_WORKFLOW_POLICY` | `observe` = evaluate only; unset or any other value = **`enforce`** (may return **422** before the provider when rules trip) |

`/health` and `/config` include `workflowPolicyMode`.

---

## Local learning (Phase 5)

Companion persists **`~/.spectyra/companion/learning-profile.json`** after each optimization. Heavy transforms (`refpack`, `phrasebook`, `spectral_scc`, etc.) are skipped automatically if local stats show repeated failure. Feature detection uses the same profile for historical signals and optional detector threshold overrides.

## Docs

- [Install & setup (all surfaces)](../../docs/INSTALL_AND_SETUP.md)  
- [Main README](../../README.md)  
