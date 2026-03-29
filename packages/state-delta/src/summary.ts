import { compileNextHopPayload } from "./compiler.js";
import { shallowDiffState } from "./diff.js";
import { stableStringify } from "./json-stable.js";
import { RefStore } from "./refs.js";
import { SharedContextIndex } from "./shared-context.js";
import type { StateSnapshot } from "./events-bridge.js";

export type StateDeltaTransitionSummary = {
  fromEventId: string;
  toEventId: string;
  fromStepId: string;
  toStepId: string;
  unchangedKeyCount: number;
  changedKeyCount: number;
  addedKeyCount: number;
  removedKeyCount: number;
  /** Rough JSON size of a compiled hop (stable keys + delta). */
  wireEstimateChars: number;
};

export type StateDeltaAnalyticsSummary = {
  snapshotCount: number;
  transitionCount: number;
  transitions: StateDeltaTransitionSummary[];
  sharedContext: { uniqueBlobs: number; reuseHits: number };
  refStoreEntries: number;
};

/**
 * Pair consecutive snapshots in the same session (time-ordered) and summarize deltas.
 */
export function summarizeStateDeltaFromSnapshots(snapshots: StateSnapshot[]): StateDeltaAnalyticsSummary {
  const shared = new SharedContextIndex();
  for (const s of snapshots) {
    shared.noteStateSlice(s.sessionId, s.stepId, s.state);
  }

  const ordered = [...snapshots].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const refStore = new RefStore();
  const transitions: StateDeltaTransitionSummary[] = [];

  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]!;
    const cur = ordered[i]!;
    if (prev.sessionId !== cur.sessionId) continue;

    const d = shallowDiffState(prev.state, cur.state);
    const priorRef = refStore.put(prev.state);
    const hop = compileNextHopPayload(prev.state, cur.state, refStore, priorRef);
    const wireEstimateChars = stableStringify(hop).length;

    transitions.push({
      fromEventId: prev.eventId,
      toEventId: cur.eventId,
      fromStepId: prev.stepId,
      toStepId: cur.stepId,
      unchangedKeyCount: Object.keys(d.unchanged).length,
      changedKeyCount: Object.keys(d.changed).length,
      addedKeyCount: Object.keys(d.added).length,
      removedKeyCount: d.removed.length,
      wireEstimateChars,
    });
  }

  return {
    snapshotCount: snapshots.length,
    transitionCount: transitions.length,
    transitions,
    sharedContext: {
      uniqueBlobs: shared.uniqueBlobCount(),
      reuseHits: shared.reuseHitCount(),
    },
    refStoreEntries: refStore.storedCount(),
  };
}
