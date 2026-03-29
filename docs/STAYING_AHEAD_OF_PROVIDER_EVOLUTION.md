# Staying ahead of provider evolution

## Principle

Spectyra’s **canonical model** and **optimization pipeline** must treat **messages** as one representation among several. Execution metadata, **state**, **delta**, **tool context**, **traces/spans**, and **task identifiers** are first-class over time so value does not collapse when providers hide tokens or move to stateful runtimes.

## Abstractions to strengthen (incremental)

| Concept | Role |
|--------|------|
| `state` | Recoverable snapshot of workflow memory |
| `delta` | Minimal change since prior snapshot |
| `intent` | High-level goal for routing |
| `execution_metadata` | Steps, retries, timings, outcomes |
| `tool_context` | Calls, results, and linkage to graph nodes |
| `stable_memory` | Long-lived facts eligible for ref/dedup |

## Metrics beyond tokens

Target metrics (where data exists):

- Cost per task, steps per task, latency per task
- Repeated context per task, retries avoided
- Low-value path counts, execution stability score

These complement token estimates so Spectyra stays relevant if accounting shifts.

## Where vendor logic lives

**Only** in `packages/adapters` and thin integration layers — never as hard-coded behavior in `optimization-engine`, `feature-detection`, `optimizer-algorithms`, `analytics-core`, or the analytics moat packages (`execution-graph`, `state-delta`, `workflow-policy`).

## Connection to new moat layers

- **Execution graph** — workflow structure for multi-step systems.
- **State/delta** — prompt-light and stateful APIs.
- **Learning** — local profiles + optional global snapshots for routing.
- **Policies** — guardrails that scale with execution cost, not string length alone.

## Documentation cross-links

- [`WHY_SPECTYRA_IS_AN_OPTIMIZATION_LAYER.md`](./WHY_SPECTYRA_IS_AN_OPTIMIZATION_LAYER.md)
- [`STATE_DELTA_OPTIMIZATION.md`](./STATE_DELTA_OPTIMIZATION.md)
- [`PRESERVE_FIRST_BOUNDARIES.md`](./PRESERVE_FIRST_BOUNDARIES.md)
