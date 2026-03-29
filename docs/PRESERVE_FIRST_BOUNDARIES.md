# Preserve-first boundaries (moat IP)

This document is the **Phase 1 preservation inventory** for Spectyra’s core algorithms and packages. It defines what must **not** be casually rewritten, and how new work (execution graph, state/delta, policies, events) should attach.

## Principles

1. **Inspect before replacing** — open the existing module and confirm whether extension or wrapping solves the need.
2. **Extend, wrap, augment** — prefer new packages and adapters over in-place rewrites of stable transforms.
3. **Keep cores provider-agnostic** — vendor/tool naming and integration logic stay in `packages/adapters` and app glue, not in `optimization-engine`, `feature-detection`, `optimizer-algorithms`, `analytics-core`, `execution-graph`, `state-delta`, or `workflow-policy` cores.
4. **Do not flatten Spectyra into “compression only”** — spectral/graph/stability logic, RefPack, Phrasebook, CodeMap, SCC, and related structures are the differentiated layer.

## Package inventory (foundations)

| Package | Role | Preserve |
|--------|------|----------|
| `packages/canonical-model` | Canonical request/response and adapter contracts | Schema evolution; avoid breaking without migration |
| `packages/adapters` | Provider-specific translation | All vendor-specific code belongs here |
| `packages/feature-detection` | Detectors for features/patterns | Heuristics; no new vendor coupling in core |
| `packages/optimization-engine` | Orchestrates transforms + pipeline | Orchestration; not a place to fork RefPack/spectral |
| `packages/optimizer-algorithms` | RefPack, Phrasebook, CodeMap, spectral SCC, budgets, context compiler, graph build | **Core IP** — highest bar for edits |
| `packages/learning` | Local/global profiles, EMA updates, transform gate helpers, pipeline feedback | Phase 5 wired into engine + Companion + optional SDK config; extend with policy (Phase 6) |
| `packages/analytics-core` | Metrics and aggregation primitives | Keep summary-first |
| `packages/prompt-diff-core` | Prompt comparison / diff | Pair with reversible refs for trust UX |
| `packages/security-core` | Security labels and policy hooks | Extend, don’t bypass |
| `packages/sdk` | Customer-facing SDK | Stable API surface |
| `packages/spectyra-agents` | Agent integrations | Adapter-style boundaries |
| `packages/event-core` / `packages/event-adapters` | Event spine (Phase 2) | Normalize to one schema; local-first |
| `packages/execution-graph` | Workflow execution graph + step scoring (Phase 3) | Analytics-only; no adapter imports |
| `packages/state-delta` | Stable state + delta + refs (Phase 4) | Analytics-first; extend via adapters |
| `packages/workflow-policy` | Cross-step policy evaluation (Phase 6) | Summary JSON in; optional observe vs default enforce in Companion; no adapter imports |
| `packages/engine-client` | Browser-safe narrow API | Must not embed full optimizer IP |

## Algorithm concepts to treat as moat (non-exhaustive)

- **RefPack**, **Phrasebook**, **CodeMap**
- **Stable turn summarization**, system dedup, consecutive dedup, context window trimming
- **Spectral SCC / signed graph / stability** (`lambda2`, stability index, contradiction energy)
- **Context compiler** (talk/code compile paths)
- **Graph build** and **edge builders** (similarity, contradiction, dependency)
- **Session tracker / analytics calculators** (where implemented)

## Enforcement in repo

- **Anti-coupling script**: `pnpm test:anti-coupling` (`packages/optimization-engine/src/__tests__/anti-coupling.test.ts`) — blocks vendor literals and forbidden imports in: optimization-engine, feature-detection, canonical-model, **analytics-core**, **event-core**, engine-client, web `src`.
- **Core smoke**: `pnpm test:preserve-core` — spectral/math exports on `optimizer-algorithms`.
- **Context compiler smoke**: `pnpm test:preserve-context` — talk-path `[SPECTYRA_STATE_TALK]` compile.
- **Event coupling**: `pnpm check:event-coupling` — recursive scan; **analytics-core** and **event-core** must not import `@spectyra/event-adapters`.

## Phase 1 completion checklist (engineering)

| Item | Command / artifact |
|------|-------------------|
| Package inventory + principles | This document |
| Optimizer numerical smoke | `pnpm test:preserve-core` |
| SCC talk compile regression | `pnpm test:preserve-context` |
| Architectural anti-coupling | `pnpm test:anti-coupling` |
| Event-core / analytics-core boundaries | `pnpm check:event-coupling` |
| One-shot CI bundle (Phases 1–2 tests) | `pnpm test:moat-phase1-2` |
| Phases 1–3 (+ execution-graph tests) | `pnpm test:moat-through-3` |
| Phases 1–4 (+ state-delta + SDK moat summaries) | `pnpm test:moat-through-4` |
| Phases 1–5 (+ learning loop) | `pnpm test:moat-through-5` |
| Phases 1–6 (+ workflow-policy) | `pnpm test:moat-through-6` |

## Phased roadmap (spec alignment)

| Phase | Focus |
|-------|--------|
| **1** | This inventory + smoke/anti-coupling + architecture docs |
| **2** | Event spine, session aggregation, local persistence, proof UI feed |
| **3** | `execution-graph` package + Companion summary API + Live Savings card (see [`EXECUTION_GRAPH.md`](./EXECUTION_GRAPH.md)) |
| **4** | `state-delta` package + Companion summary API + Live Savings card (see [`STATE_DELTA_OPTIMIZATION.md`](./STATE_DELTA_OPTIMIZATION.md)) |
| **5** | Learning loop: transform gate, feature calibration, profile persistence (Companion disk; SDK optional `learningProfile` on config) |
| **6** | Workflow policy package + Companion pre-provider gate + summary + Live Savings card (see [`WORKFLOW_POLICY_ENGINE.md`](./WORKFLOW_POLICY_ENGINE.md)) |
| **7** | Product/docs/UI positioning |

## Related docs

- [`WHY_SPECTYRA_IS_AN_OPTIMIZATION_LAYER.md`](./WHY_SPECTYRA_IS_AN_OPTIMIZATION_LAYER.md)
- [`EXECUTION_GRAPH.md`](./EXECUTION_GRAPH.md)
- [`STATE_DELTA_OPTIMIZATION.md`](./STATE_DELTA_OPTIMIZATION.md)
- [`WORKFLOW_POLICY_ENGINE.md`](./WORKFLOW_POLICY_ENGINE.md)
- [`LOCAL_EVENT_SPINE.md`](./LOCAL_EVENT_SPINE.md)
- [`STAYING_AHEAD_OF_PROVIDER_EVOLUTION.md`](./STAYING_AHEAD_OF_PROVIDER_EVOLUTION.md)
