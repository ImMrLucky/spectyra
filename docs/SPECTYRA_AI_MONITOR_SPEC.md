# Spectyra Spec — AI Cost Monitoring, Auto-Instrumentation, Deep SDK Integration, Python SDK, Lit Overlay, and Full AI Activity Coverage

> Version: 1.0  
> Purpose: One master implementation spec for Cursor  
> Primary goal: Make Spectyra the easiest way for companies to see where AI spend is happening, why it is happening, what is wasteful, and how much Spectyra can save.

See the canonical full text in repository history or product docs; this file is the **checkpoint** for engineering. **Do not modify** `openclaw-skill` or `@spectyra/local-companion` for this initiative unless explicitly instructed.

## Product model

- **Monitor** — free, always valuable, shows real provider AI spend  
- **Analytics** — optional metadata sync to Spectyra Cloud dashboard  
- **Optimizer** — paid, reduces cost when enabled and entitled  

Monitoring must continue when optimization is disabled, quota is exhausted, billing is inactive, or Spectyra Cloud is unavailable.

## Privacy (BYOK)

Never receive or persist: provider API keys, prompt text, response text, uploaded files, raw tool output, raw user identifiers (unless explicitly configured), `Authorization` headers.

Allowed: redacted metadata (provider, model, tokens, estimated cost, latency, status, labels, hashed tenant/user ids, optimizer status, savings / missed savings, waste signals).

## Reliability

If monitoring, JSONL, cloud sync, entitlement check, or optimizer fails — **the LLM call still proceeds**.

## Naming (required)

- Actual Spend (Provider)  
- Optimized Spend (Spectyra)  
- Savings  
- Potential Spend with Spectyra  
- Missed Savings  
- Optimizer Status  
- Monitoring Status  

## Package architecture (target)

| Package | Role |
|--------|------|
| `@spectyra/sdk` | Full explicit SDK: monitor core, pricing, JSONL, buffer, summaries, analytics sync, optimizer, adapters |
| `@spectyra/auto` | One-line auto-instrumentation (HTTP / fetch patches) — powered by SDK |
| `@spectyra/devtools` | Lit overlay, framework-agnostic |
| Python `spectyra` (`sdks/python`) | Monitor core + optional `urllib` auto-hook (Phases 3–4) |

## Implementation phases (summary)

1. Shared monitor core in `@spectyra/sdk`  
2. Node `@spectyra/auto`  
3. Python monitor core  
4. Python auto  
5. Waste detection  
6. Dev bridge (`/__spectyra`)  
7. Lit `@spectyra/devtools`  
8. Provider / framework hooks  
9. Cloud analytics sync  
10. Optimizer gating + free tier messaging  

## Full specification

The complete multi-section spec (constraints, naming, phases 1–10, JSONL rules, waste detection, `@spectyra/auto`, Lit overlay, cloud routes, tests, acceptance criteria) is maintained in the product engineering source of truth. **This file lists in-repo implementation status** for each phase.

## Phase 1 — `@spectyra/sdk` monitor core

**Landed** in `packages/sdk/src/monitor/` for the explicit `complete()` / `run()` path:

- Monitor event types (`SpectyraMonitorEvent`, `SpectyraWasteSignal`)  
- **Automatic emission** after each successful `complete()` / `run()`, plus a **failure row** on throw — never breaks the LLM call  
- `buildMonitorEventFromComplete` / `buildFailureMonitorEvent` (public)  
- Provider detection + usage extraction + redaction + JSONL + buffer + summaries  
- Opt-in: `createSpectyra({ monitor: { enabled: true, … } })`  

Tests: `pnpm --filter @spectyra/sdk run test:monitor-core`, `test:monitor-complete`.

## Phase 2 — `@spectyra/auto`

**Landed** in `packages/auto`: fetch / http (CJS export) / axios hooks, env-gated side-effect import, smoke test `pnpm --filter @spectyra/auto run test:auto`.

## Phase 3–4 — Python (`sdks/python`)

**Landed** in `sdks/python/src/spectyra/`:

- **Phase 3:** `spectyra.monitor` — `MonitorEngine`, JSONL, redaction, summaries, provider host detection.  
- **Phase 4:** `spectyra.automation` — `start_spectyra_auto` / `stop_spectyra_auto` / `get_auto_monitor_engine` (`urllib.request.urlopen` hook).  
- Tests: `cd sdks/python && PYTHONPATH=src python3 -m unittest discover -s tests -p 'test_*.py' -v`  
- Doc: `docs/SPECTYRA_PYTHON_MONITORING.md`

## Phase 5 — Waste detection

**Landed (heuristics v1)** in `packages/sdk/src/monitor/wasteHeuristics.ts`:

- Attached to **`buildMonitorEventFromComplete`** output as `wasteSignals` (metadata-only titles/descriptions).  
- **`buildWasteSignalsFromHttpAutoPath`** used by `@spectyra/auto` `recordMonitorFromJsonBody` for auto-captured calls.

## Phase 6 — Dev bridge `/__spectyra`

**Landed** in `packages/sdk/src/monitor/localDevServer.ts`:

- `GET /__spectyra/monitor/summary` — JSON summary  
- `GET /__spectyra/monitor/events?limit=` — recent rows (cap 500)  
- **Off in production** unless `SPECTYRA_DEV_BRIDGE=true`  
- **`createSpectyraDevBridgeConnectMiddleware`** — Connect/Express-style middleware  

`createSpectyraDevBridgePlaceholder` remains as a deprecated no-op for backwards compatibility.

## Phase 7 — Lit `@spectyra/devtools`

**Landed** in `packages/devtools`: re-exports SDK mount helpers + **`<spectyra-monitor-strip>`** (Lit) polling the Phase 6 bridge. Build: `pnpm --filter @spectyra/devtools run build`.

## Phase 8 — Provider / framework hooks

**Landed (minimal)** — the Connect middleware above is the supported integration surface for Node HTTP stacks (Express, Connect, raw `http.createServer`). Framework-specific shims can wrap the same `getEngine()` pattern.

## Phase 9 — Cloud analytics sync (monitor batches)

**Landed**:

- **Ingest (machine):** `POST /v1/telemetry/monitor-events` (`X-SPECTYRA-API-KEY`), body `{ project?, events: SpectyraMonitorEvent[] }` (max 200 rows). Table `sdk_monitor_event_batches` (`ensureSdkTelemetrySchema`).  
- **SDK:** `flushMonitorEventsToCloud` — `packages/sdk/src/cloud/monitorSync.ts` (fail-open).  
- **Read (dashboard JWT):**  
  - `GET /v1/projects/:projectId/monitor/rollup?days=30` — event counts, total Actual Spend (Provider), breakdown by provider.  
  - `GET /v1/projects/:projectId/monitor/batches?limit=15` — recent batch payloads for tables.  
- **Web UI:** authenticated route **`/monitoring`** (`AiMonitorPage`) — project picker, rollup cards, recent-event table. Deep link: `/monitoring?project=<projectId>` (also linked from **Projects → project**).

## Phase 10 — Optimizer gating + free tier messaging

**Landed (browser overlay)** — `mountSpectyraDevtools` already surfaces entitlement / quota / upgrade links. When `monitor.enabled` is on, **`getMonitorSummary`** is passed into the overlay so **Monitoring Status** rollups (requests, Actual Spend, Missed savings, p95 latency) appear beside optimizer state (`packages/sdk/src/devtools/mountDevtools.ts`).

## Security acceptance (release gate)

No `Authorization`, provider keys, prompts, responses, or raw bodies in JSONL; dev bridge and overlay safe-by-default in production; all failures fail-open.
