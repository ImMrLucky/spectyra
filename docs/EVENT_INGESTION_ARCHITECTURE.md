# Event ingestion architecture

Spectyra’s analytics are built on a **local-first pipeline**: tool-specific inputs → **adapters** (`@spectyra/event-adapters`) → normalized **`SpectyraEvent`** (`@spectyra/event-core`) → **session aggregation** → **live UI state** (`LiveSessionState`).

## Layers

| Package | Role |
|--------|------|
| `@spectyra/event-core` | Normalized event model, `SpectyraEventAdapter` interface, local event bus, dedupe, ingestion engine, session aggregator, sync-safe redaction helpers |
| `@spectyra/event-adapters` | SDK, Local Companion, OpenClaw JSONL, Claude hooks/JSONL, OpenAI tracing, generic JSONL |
| `@spectyra/analytics-core` | Savings math, step/session records, report building — **no tool-specific parsing** |

## Flow

1. **Ingest** — `createEventIngestionEngine({ adapters, dedupe })` picks the first adapter where `canHandle(input)` is true, runs `ingest()`, validates with `assertNormalizedEvent`, optionally dedupes, pushes into `EventSessionAggregator`, publishes on the bus.
2. **Subscribe** — `engine.subscribe(handler)` for real-time consumers (e.g. SSE in Local Companion).
3. **Snapshot** — `engine.getLiveState()` returns aggregated session + steps + prompt-comparison flags for HTTP/UI.

## Local Companion

The companion wires `defaultEventAdapters` into a singleton engine, calls `ingestCompanionChatCompleted` after each optimized provider call (when telemetry is not `off`), and exposes:

- `GET /v1/analytics/live-events` — SSE stream of normalized events  
- `GET /v1/analytics/live-state` — JSON snapshot  

Other analytics routes (`/v1/analytics/*`) serve persisted/session data from the existing companion store.

- **`POST /v1/analytics/ingest`** — Accepts any JSON object that matches a registered adapter envelope (same pipeline as in-process sources). **Daemon / log-shipper** integration: tail JSONL or watch a queue, POST each record to this endpoint. Returns **422** if no adapter matches.

## SDK

The SDK can optionally use `sdkEventEngine` and `ingestSdkComplete()` so host apps emit the same normalized events as the companion. See `packages/sdk/src/events/sdkEvents.ts`.

## Principles

- **No cloud required** for ingestion, aggregation, or live UI.
- **Raw prompts, responses, and vendor logs stay local** by default; only normalized summaries are candidates for optional account sync (see [LOCAL_ANALYTICS_AND_SYNC.md](./LOCAL_ANALYTICS_AND_SYNC.md)).
- **Vendor logic lives in adapters only** — not in `analytics-core` or session aggregation logic paths.
