# Local event spine (architecture + direction)

## Goals

- **One normalized event model** for SDK, Local Companion, desktop, and adapter-driven sources (OpenClaw JSONL, Claude hooks, OpenAI-style traces, generic JSONL).
- **Local-first**: raw events and prompt bodies stay on the customer machine by default; optional sync sends **summaries** or normalized aggregates.
- **Event bus** for real-time UI (SSE/WebSocket from companion/desktop) without coupling core algorithms to UI code.

## Existing building blocks in repo

- `packages/event-core` — shared event types and utilities (extend, don’t fork).
- `packages/event-adapters` — source-specific mappers (extend with new adapters).
- Docs: [`NORMALIZED_EVENT_MODEL.md`](./NORMALIZED_EVENT_MODEL.md), [`EVENT_INGESTION_ARCHITECTURE.md`](./EVENT_INGESTION_ARCHITECTURE.md), [`ADDING_EVENT_ADAPTERS.md`](./ADDING_EVENT_ADAPTERS.md).

## Read / tool lifecycle (planned module)

Track per read or tool output:

- First seen, last used, still referenced, stale, superseded, repeated, expensive to resend.

Classifications (target): fresh, reused, stale, superseded, compressible — feeding **execution graph** scoring and **workflow policies**.

## Customer proof

Pairs with product requirements:

- Local: live savings, session breakdown, transforms, security labels, sync status.
- Cloud (if enabled): aggregate savings with clear **local vs synced** messaging.

## Anti-coupling

- `analytics-core` and **event** packages must not import web UI or integration pages.
- Enforcement: existing `pnpm check:event-coupling` plus [`PRESERVE_FIRST_BOUNDARIES.md`](./PRESERVE_FIRST_BOUNDARIES.md).

## Implementation status (Phase 2) — **complete** (engineering scope)

| Capability | Detail |
|------------|--------|
| Normalized model + bus | `@spectyra/event-core` (`SpectyraEvent`, `createLocalEventBus`, `createEventIngestionEngine`) |
| Adapters | `@spectyra/event-adapters` (`defaultEventAdapters`: SDK, companion, OpenClaw, Claude, OpenAI tracing, generic JSONL) |
| Session aggregation | `EventSessionAggregator` + `analytics-core` `SpectyraSessionTracker` (companion file + in-memory engine) |
| Local persistence | `runs.jsonl`, `sessions.jsonl`, prompt comparisons, **`events.jsonl`** (`SPECTYRA_PERSIST_EVENTS=false` to disable append) |
| Real-time feed | **SSE** `GET /v1/analytics/live-events`, JSON **`GET /v1/analytics/live-state`** |
| Read recent events | **`GET /v1/analytics/events/recent?limit=`** |
| Ingest external logs | **`POST /v1/analytics/ingest`** |
| SDK | Same envelopes via `sdkEventEngine` / `ingestSdk*`; Phase 3–4 summaries via `moatPhase34SummariesFromSdkBuffer()` (same logic as Companion HTTP summaries) |
| Desktop proof UI | **Live savings** (metrics, steps, event log, optional cloud sync); **Dashboard** → Run history, Live savings |
| Tests | `pnpm test:event-spine` (JSONL), **`pnpm test:event-ingestion`** (adapters + aggregator), **`pnpm test:analytics-session`** (session tracker) |

**Phase 2 regression bundle:** `pnpm test:moat-phase1-2` (includes Phase 1 + Phase 2 tests, anti-coupling, event-coupling).

Later work (not Phase 2): WebSocket transport, richer step/flow analytics UI. **Phase 3–4 linkage** (Companion + Live Savings + SDK helpers) is shipped; deeper visualization and policy enforcement remain future phases.
