# Moat upgrade roadmap (spec alignment)

This roadmap maps the **Preserve-First Moat Upgrade** spec to concrete repo phases. Details live in the linked docs.

| Phase | Deliverables |
|-------|----------------|
| **1 — Preservation** | **Complete (engineering):** inventory + moat docs, `pnpm test:preserve-core`, `pnpm test:preserve-context`, `pnpm test:anti-coupling` (incl. analytics-core + event-core), `pnpm check:event-coupling` — [`PRESERVE_FIRST_BOUNDARIES.md`](./PRESERVE_FIRST_BOUNDARIES.md) |
| **2 — Event spine + proof** | **Complete (engineering):** ingestion engine, adapters, bus, SSE, live-state, disk sessions + **`events.jsonl`**, `events/recent`, SDK parity, desktop Live savings + dashboard links, tests — [`LOCAL_EVENT_SPINE.md`](./LOCAL_EVENT_SPINE.md), [`LOCAL_ANALYTICS_AND_SYNC.md`](./LOCAL_ANALYTICS_AND_SYNC.md) |
| **3 — Execution graph** | **Complete (engineering):** `@spectyra/execution-graph`, Companion `GET /v1/analytics/execution-graph/summary`, Live Savings card, SDK `moatPhase34SummariesFromSdkBuffer()` (shared summarizer) — [`EXECUTION_GRAPH.md`](./EXECUTION_GRAPH.md) |
| **4 — State / delta** | **Complete (engineering):** `@spectyra/state-delta`, Companion `GET /v1/analytics/state-delta/summary`, Live Savings card, same SDK helpers — [`STATE_DELTA_OPTIMIZATION.md`](./STATE_DELTA_OPTIMIZATION.md) |
| **5 — Learning loop** | **Complete (engineering):** `@spectyra/learning` transform gate in `optimization-engine`, `detectFeatures` historical + calibration merge (Companion + SDK), disk profile `~/.spectyra/companion/learning-profile.json`, `pnpm test:learning-loop` / `pnpm test:moat-through-5` — [`LEARNING_MODEL.md`](./LEARNING_MODEL.md) |
| **6 — Workflow policies** | **Complete (engineering):** `@spectyra/workflow-policy`, Companion policy gate on chat + messages (default **enforce**), matching `GET /v1/analytics/workflow-policy/summary`, Live Savings card + `workflowPolicyMode` from `/health`, `pnpm test:workflow-policy` / `pnpm test:moat-through-6` — [`WORKFLOW_POLICY_ENGINE.md`](./WORKFLOW_POLICY_ENGINE.md) |
| **7 — UI/docs** | **Complete (engineering pass):** Live Savings workflow-policy copy aligned with enforce vs observe; moat docs + env defaults (`on` run mode, `SPECTYRA_WORKFLOW_POLICY`) — ongoing product polish without new per-phase `.md` sprawl |

**Engineering gate for Phases 1–4:** `pnpm test:moat-through-4`.

**Engineering gate through Phase 5:** `pnpm test:moat-through-5`.

**Engineering gate through Phase 6 (before Phase 7):** `pnpm test:moat-through-6` — adds workflow-policy unit tests.

**Acceptance** is defined in the product spec; engineering uses this file to sequence work without rewriting core IP unnecessarily.
