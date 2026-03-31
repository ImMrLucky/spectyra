# Agentic environments and server-side integration

Spectyra supports **seamless** analytics across OpenClaw-style agents, Claude-style harnesses, and “no access” server setups without claiming universal interception of every closed app.

## 1. Integration tiers (best → fallback)

| Tier | When to use | What you get |
|------|-------------|--------------|
| **A — SDK in-process** | You control the Node/TS process that calls the LLM | Full optimization + normalized events via `createSpectyra()` / `startSpectyraSession()` + `sdkEventEngine.subscribe()`. |
| **B — Local Companion (HTTP)** | The tool supports a **custom OpenAI or Anthropic base URL** (OpenClaw, many coding agents) | Same optimization path as the proxy; no code changes in the agent — only `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL`. Real-time analytics via `/v1/analytics/*` and SSE `live-events`. |
| **C — JSONL / log tail** | The tool **writes structured logs** locally | Tail or batch-read files; map lines to adapter envelopes (`spectyra.openclaw.jsonl.v1`, etc.) and POST them to the companion (see §4). |
| **D — HTTP ingest daemon** | You **cannot** patch the agent or its runtime | Run a small process that watches logs, filesystem, or a message queue and POSTs JSON to **`POST /v1/analytics/ingest`** on the Local Companion. Same normalization pipeline as in-process adapters. |
| **E — Generic JSONL** | Unknown or evolving format | Use `@spectyra/event-adapters` **generic JSONL** with a field mapping config; metrics may be partial until the mapping is tuned. |

**We do not claim** to capture every closed app. Prefer **official** structured sources (SDK, companion proxy, documented JSONL, tracing hooks).

## 2. OpenClaw install (official) vs Spectyra

- **Install OpenClaw** from **openclaw.ai**: macOS/Linux use `curl -fsSL https://openclaw.ai/install.sh | bash`; Windows PowerShell uses `iwr -useb https://openclaw.ai/install.ps1 | iex`. OpenClaw requires **Node.js 22.14+**. See [INSTALL_AND_SETUP.md](./INSTALL_AND_SETUP.md#openclaw-official-installer).
- **Then** point the agent at **Spectyra’s Local Companion** — Spectyra does not ship OpenClaw; it integrates **after** OpenClaw is installed.

## 3. OpenClaw ↔ Claude-style harness “seamless” behavior

- **Same host**: Point both at the same **Local Companion** base URL (`http://127.0.0.1:4111/v1` or `/v1/messages` for Anthropic-shaped clients). Sessions can be correlated via `X-Spectyra-Session-*` headers where the companion session registry supports them.
- **Same event model**: Whether events originate from the companion’s chat handlers or from **`POST /v1/analytics/ingest`**, they become **`SpectyraEvent`** and feed **`session-aggregator`**, `live-state`, and SSE.
- **SDK**: Use **`runContext.sessionId`** on `complete()` to correlate multiple standalone completes, or **`startSpectyraSession`** for explicit session lifecycle + normalized events (no duplicate emits: `emitNormalizedEvents` is suppressed for inner completes).

## 4. Server / daemon without direct agent integration

When you **cannot** integrate with Claude or the agentic harness (no hooks, no SDK, no base URL):

1. **Run Local Companion** on the same machine or a reachable host (still local-first; no cloud required for inference).
2. **Run a sidecar** (script, systemd unit, launchd, or Docker) that:
   - reads a **JSONL file**, **directory**, or **queue**;
   - parses each line or message into a **known envelope** (see `@spectyra/event-adapters`);
   - POSTs JSON to **`POST http://127.0.0.1:4111/v1/analytics/ingest`** (adjust host/port).
3. If telemetry is **`off`** in companion config, ingest returns **403** — enable local telemetry in config.

Example (conceptual):

```bash
curl -sS -X POST "http://127.0.0.1:4111/v1/analytics/ingest" \
  -H "Content-Type: application/json" \
  -d '{"kind":"spectyra.sdk.v1","phase":"complete","sessionId":"...","runId":"...","report":{...}}'
```

Response: `{ "ok": true, "count": 2 }` when adapters produced normalized events; **422** if no adapter matched the body.

## 5. Security defaults

- Raw prompts, responses, and vendor logs stay **local** unless the user opts in elsewhere.
- Ingest payloads should contain **metadata and metrics**, not raw prompts, unless you explicitly control a local-only path.
- See [LOCAL_ANALYTICS_AND_SYNC.md](./LOCAL_ANALYTICS_AND_SYNC.md) for sync boundaries.

## 6. Further reading

- [EVENT_INGESTION_ARCHITECTURE.md](./EVENT_INGESTION_ARCHITECTURE.md) — pipeline overview  
- [ADDING_EVENT_ADAPTERS.md](./ADDING_EVENT_ADAPTERS.md) — new tool support  
- [NORMALIZED_EVENT_MODEL.md](./NORMALIZED_EVENT_MODEL.md) — `SpectyraEvent` schema  
