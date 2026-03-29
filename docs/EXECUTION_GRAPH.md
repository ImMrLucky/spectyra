# Execution graph layer

## Purpose

Add an explicit **execution graph** on top of existing canonical units, signed graphs, and spectral analysis — **without replacing** `buildGraph` / spectral SCC in `optimizer-algorithms`. The execution graph answers workflow questions: what depended on what, what repeated, what was low value, and where retries/loops occurred.

## Relationship to existing code

- **Canonical model** — messages, tool calls, bundles, and execution metadata feed **builders**.
- **optimizer-algorithms** — continues to own **semantic unit graph**, Laplacian, stability, RefPack/Phrasebook/CodeMap **unless** a measured extension requires shared types.
- **Package** — `packages/execution-graph/`: types, builder, scoring, pruning suggestions, policies hooks, `summarizeExecutionGraphFromSpectyraEvents()` for the same JSON shape as the Local Companion route.

## Node kinds (target)

- Step, request, tool call, tool result, state checkpoint, context bundle, response.

## Edge kinds (target)

- `depends_on`, `derived_from`, `reuses_context`, `repeats`, `supersedes`, `contradicts`, `low_value_path`.

## Capabilities (target)

- Step usefulness scoring (see scoring module spec).
- Repeated path and retry/loop detection.
- Stale/superseded read markers (paired with [`lifecycle`](./LOCAL_EVENT_SPINE.md) tracking).
- Workflow analytics and future visualization — **read-only first**; pruning is a later phase behind policy.

## Step usefulness (outline)

Scores classify steps (e.g. critical / useful / compressible / low_value / likely_redundant) using tokens, downstream dependency counts, contribution to final output, repetition signals, instability, and outcomes. **Observation and analytics precede pruning** in the rollout plan.

## Implementation status (Phase 3)

- **Package** — `@spectyra/execution-graph` (see `packages/execution-graph/src`).
- **Local Companion** — `GET /v1/analytics/execution-graph/summary` (telemetry off → 403). Uses `summarizeExecutionGraphFromSpectyraEvents` on the in-memory event snapshot.
- **Web** — Live Savings page shows an “Execution graph (Phase 3)” summary card when the companion returns data.
- **SDK** — `moatPhase34SummariesFromEvents` / `moatPhase34SummariesFromSdkBuffer` in `@spectyra/sdk` (same summaries from `sdkEventEngine.snapshot()`).

Root CI: `pnpm test:execution-graph`; full Phases 1–4 gate: `pnpm test:moat-through-4`.
