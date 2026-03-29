# Why Spectyra is an optimization layer (not “just compression”)

## What is preserved

Spectyra’s existing pipeline is built around **structure**, not naive shortening:

- **Graph- and spectral-aware** analysis of conversation units (stability, contradiction energy, reuse vs expand decisions).
- **Semantic packaging** via RefPack, Phrasebook, and CodeMap — not generic gzip-for-text.
- **Context compiler** paths that respect talk vs code workflows and SCC-style normalization.
- **Feature detection** and **budgets** that gate how aggressively transforms apply.

These are intentionally **provider/tool-agnostic** in core packages; adapters map vendor APIs into the canonical model.

## What “execution optimization layer” adds

The next moat layers sit **around** that core without replacing it:

1. **Execution graph** — explicit workflow structure (steps, tools, state, responses) for path efficiency, redundancy, and analytics.
2. **State / delta** — stable base + delta + refs so Spectyra stays valuable if providers move toward stateful or prompt-light APIs.
3. **Lifecycle tracking** — fresh vs stale vs superseded reads and tool outputs (major source of agentic waste).
4. **Learning loop** — local-first profiles that influence routing and aggressiveness, with optional aggregate snapshots.
5. **Workflow policies** — guarded rules (cost, retries, stale blocks); Local Companion defaults to enforce with optional `observe` via env.
6. **Event spine + proof UI** — believable, local-first evidence of savings and behavior.

## Why this stays valuable if tokens disappear from view

Provider dashboards may hide per-token accounting. Spectyra still measures and optimizes **execution**: steps per task, repeated context, retries, low-value paths, stability, and cost **per task** where estimates exist. The **canonical model** is extended to carry execution metadata, not only messages.

## Non-goals

- Replacing spectral/graph logic with shallow heuristics.
- Coupling core packages to a single vendor’s SDK or tool names.
- Uploading raw prompts by default for “learning.”

See also [`PRESERVE_FIRST_BOUNDARIES.md`](./PRESERVE_FIRST_BOUNDARIES.md) and [`STAYING_AHEAD_OF_PROVIDER_EVOLUTION.md`](./STAYING_AHEAD_OF_PROVIDER_EVOLUTION.md).
