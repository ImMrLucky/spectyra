/**
 * Phase 3–4 summaries from SDK event buffer / explicit event arrays.
 */
import assert from "node:assert";
import type { SpectyraEvent } from "@spectyra/event-core";
import { moatPhase34SummariesFromEvents, moatPhase34SummariesFromSdkBuffer } from "../analytics/sdkMoatSummaries.js";

const e = (partial: Partial<SpectyraEvent> & Pick<SpectyraEvent, "id" | "type">): SpectyraEvent => ({
  id: partial.id,
  type: partial.type,
  timestamp: partial.timestamp ?? "2026-03-01T12:00:00.000Z",
  source: partial.source ?? { adapterId: "test", integrationType: "sdk-wrapper" },
  sessionId: partial.sessionId ?? "sess",
  runId: partial.runId ?? "run",
  stepId: partial.stepId,
  payload: partial.payload ?? {},
  security: partial.security ?? {
    telemetryMode: "local",
    promptSnapshotMode: "local_only",
    localOnly: true,
  },
});

const events: SpectyraEvent[] = [
  e({ id: "1", type: "step_started", stepId: "a", payload: { estimatedInputTokens: 10 } }),
  e({
    id: "2",
    type: "optimization_applied",
    stepId: "a",
    payload: { inputTokensAfter: 8, transformsApplied: ["x"] },
  }),
];

const p = moatPhase34SummariesFromEvents(events);
assert.ok(p.executionGraph.nodeCount >= 1);
assert.ok(p.stateDelta.snapshotCount >= 1);

const q = moatPhase34SummariesFromSdkBuffer();
assert.ok(typeof q.executionGraph.nodeCount === "number");

console.log("✅ sdk moat Phase 3–4 summary helpers ok");
