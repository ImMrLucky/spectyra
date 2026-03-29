# State / delta optimization

## Purpose

Formalize **stable base + delta + refs** so Spectyra optimizes **state evolution** across steps, not only the next prompt string. This keeps the product relevant if providers emphasize **stateful**, **prompt-light**, or **tool-native** APIs.

## Preserve-first stance

- **Extend** the existing `contextCompiler` and RefPack concepts — do not replace them in one sweep.
- **Adapters** translate provider-specific state blobs into canonical **state** / **delta** / **ref** bundles.

## Package layout

`packages/state-delta/`:

- `types.ts` — canonical keyed state, shallow diff shape, compiled hop payload, ref handle type.
- `stable-memory.ts` — unchanged keys / stable slice vs prior snapshot.
- `diff.ts` — top-level key delta between two canonical states (stable JSON equality).
- `compiler.ts` — `compileNextHopPayload` (unchanged keys + set/tombstones + large values as refs).
- `refs.ts` — `RefStore` (SHA-256 keyed, reversible in-process).
- `shared-context.ts` — `SharedContextIndex` content-addressed reuse counts (local-first).
- `events-bridge.ts` — `extractStateSnapshotsFromSpectyraEvents` (generic payload keys only).
- `summary.ts` — `summarizeStateDeltaFromSnapshots` for analytics.

## Behaviors (target)

- For consecutive workflow steps: compute stable vs changed, emit delta payload, replace repeats with refs where safe.
- Allow adapters to emit **full message-style** or **state + delta** style requests.

## Compatibility

- Chat/message flows today.
- Code- and tool-heavy workflows.
- Future provider APIs that expose state snapshots or spans instead of raw chat logs.

## Reversible compression

Refs and compressed bundles must retain a **local** path to reconstruct originals for trust, enterprise review, and prompt comparison UIs — see [`prompt-diff-core`](../packages/prompt-diff-core/) and future `refs.ts` integration.

## Implementation status (Phase 4)

- **Package** — `@spectyra/state-delta` (`packages/state-delta/src`).
- **Local Companion** — `GET /v1/analytics/state-delta/summary` (telemetry off → 403). Uses the in-memory event snapshot, same as the execution-graph summary.
- **Web** — Live Savings shows a “State / delta (Phase 4)” card when data is available.
- **SDK** — included in `moatPhase34SummariesFromEvents` / `moatPhase34SummariesFromSdkBuffer` (`@spectyra/sdk`).

Root: `pnpm test:state-delta`; full Phases 1–4 gate: `pnpm test:moat-through-4` (includes SDK summary smoke test).

Optimizer / spectral code paths are unchanged; this layer supplies analytics summaries and shared types for workflow policy and future adapter wiring.
