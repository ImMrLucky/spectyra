# Adding event adapters

## Interface

Implement `SpectyraEventAdapter<TInput>` from `@spectyra/event-core`:

```ts
interface SpectyraEventAdapter<TInput = unknown> {
  id: string;
  integrationType: /* sdk-wrapper | local-companion | … */;
  canHandle(input: unknown): boolean;
  ingest(input: TInput, context?: AdapterContext): SpectyraEvent[];
}
```

## Rules

**May:** parse JSONL, traces, hooks, or structured SDK payloads; enrich `source`; set `security` flags; emit multiple events per input.

**Must not:** compute final savings reports inside the adapter (use events + `@spectyra/analytics-core`); embed optimization policy; upload data to the network.

## Registration

1. Add `src/<your-adapter>/adapter.ts` under `@spectyra/event-adapters`.
2. Export the adapter from `packages/event-adapters/src/index.ts` and append to `defaultEventAdapters` in **stable priority order** (more specific adapters before `generic-jsonl`).
3. Run `pnpm --filter @spectyra/event-adapters run typecheck`.

## Ordering

`createEventIngestionEngine` uses the **first** adapter where `canHandle` is true. Put narrowly scoped adapters (e.g. SDK, companion) before broad heuristics (generic JSONL).

## Tests

Keep **`canHandle`** narrow enough that two adapters do not both accept the same payload unless intentional. Prefer explicit envelope shapes (e.g. `{ kind: "spectyra.foo.v1", … }`) for stable routing.
