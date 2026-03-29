/**
 * Phase 3–4 moat analytics from the same normalized `SpectyraEvent[]` stream as Local Companion
 * (SDK buffer via `sdkEventEngine.snapshot()`).
 */

import type { SpectyraEvent } from "@spectyra/event-core";
import {
  summarizeExecutionGraphFromSpectyraEvents,
  type ExecutionGraphSummaryPayload,
} from "@spectyra/execution-graph";
import {
  extractStateSnapshotsFromSpectyraEvents,
  summarizeStateDeltaFromSnapshots,
  type StateDeltaAnalyticsSummary,
} from "@spectyra/state-delta";
import { sdkEventEngine } from "../events/sdkEvents.js";

export type SdkMoatPhase34Payload = {
  executionGraph: ExecutionGraphSummaryPayload;
  stateDelta: StateDeltaAnalyticsSummary;
};

export function moatPhase34SummariesFromEvents(events: SpectyraEvent[]): SdkMoatPhase34Payload {
  const snapshots = extractStateSnapshotsFromSpectyraEvents(events);
  return {
    executionGraph: summarizeExecutionGraphFromSpectyraEvents(events),
    stateDelta: summarizeStateDeltaFromSnapshots(snapshots),
  };
}

/** Reads `sdkEventEngine.snapshot()` (normalized events emitted by the SDK pipeline). */
export function moatPhase34SummariesFromSdkBuffer(): SdkMoatPhase34Payload {
  return moatPhase34SummariesFromEvents(sdkEventEngine.snapshot());
}
