# Workflow policy engine

Cross-step **rules** over execution metrics, state-delta signals, and (later) cost/session budgets. Violations are always computed. **Local Companion defaults to `enforce`** (can return HTTP **422** and skip the provider when rules trip). Set **`SPECTYRA_WORKFLOW_POLICY=observe`** for reporting-only (same summary shape; never blocks).

## Package

`packages/workflow-policy/` — zero workspace dependencies; consumes **JSON-shaped** context only.

| Module | Role |
|--------|------|
| `types.ts` | `WorkflowPolicyConfig`, `WorkflowPolicyContext`, `WorkflowPolicyResult` |
| `defaults.ts` | Conservative thresholds |
| `evaluator.ts` | `evaluateWorkflowPolicies(ctx, config?)` |

## Rules (initial)

- **high_low_value_ratio** — too many steps classified `low_value` / `likely_redundant` vs execution graph scores.
- **too_many_repeat_loops** — repeat-loop group count from execution graph summary.
- **large_state_delta_hop** — single transition wire estimate from state-delta summary.

## Integration

- **Local Companion** — Before **`POST /v1/chat/completions`** and **`POST /v1/messages`**, runs the same evaluation as `GET /v1/analytics/workflow-policy/summary`. Mode follows **`SPECTYRA_WORKFLOW_POLICY`** (`enforce` default, `observe` = never block). Telemetry off → summary routes **403**; inference still runs unless policy blocks in enforce mode.
- **Web** — Live Savings “Workflow policy (Phase 6)” card.
- **Tests** — `pnpm test:workflow-policy`; full moat gate `pnpm test:moat-through-6`.

## Relationship to other moat packages

- **execution-graph** — still owns graph build/scoring; workflow-policy **reuses summary fields**, not graph types.
- **optimization-engine** — unchanged; policy gates sit in Local Companion HTTP (and can be reused in SDK hosts via `@spectyra/workflow-policy`).

## Future

Cost caps, learning feedback from repeated violations — extend this doc or [`MOAT_UPGRADE_ROADMAP.md`](./MOAT_UPGRADE_ROADMAP.md) only; avoid new top-level `.md` files per phase.
