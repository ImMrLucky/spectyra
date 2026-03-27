import type { SpectyraEvent } from "./types.js";
import type { AdapterContext, SpectyraEventAdapter } from "./adapter-interface.js";
import { createLocalEventBus } from "./bus.js";
import { createEventDeduper } from "./dedupe.js";
import { assertNormalizedEvent } from "./normalizer.js";
import { EventSessionAggregator } from "./session-aggregator.js";

export type EventIngestionEngineOptions = {
  adapters: SpectyraEventAdapter[];
  dedupe?: boolean;
  /** Called after each normalized event (bus + aggregator). */
  onEvent?: (event: SpectyraEvent) => void;
};

export function createEventIngestionEngine(opts: EventIngestionEngineOptions) {
  const bus = createLocalEventBus();
  const deduper = opts.dedupe ? createEventDeduper() : null;
  const aggregator = new EventSessionAggregator();

  function ingest(input: unknown, context?: AdapterContext): SpectyraEvent[] {
    const adapter = opts.adapters.find((a) => a.canHandle(input));
    if (!adapter) return [];
    const raw = adapter.ingest(input as never, context);
    const out: SpectyraEvent[] = [];
    for (const e of raw) {
      try {
        assertNormalizedEvent(e);
      } catch {
        continue;
      }
      if (deduper?.isDuplicate(e.id)) continue;
      aggregator.push(e);
      bus.publish(e);
      opts.onEvent?.(e);
      out.push(e);
    }
    return out;
  }

  return {
    ingest,
    subscribe: bus.subscribe,
    getAggregator: () => aggregator,
    getLiveState: () => aggregator.getLiveState(),
    snapshot: bus.snapshot,
  };
}
