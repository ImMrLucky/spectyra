/**
 * Phase 3: dependency correctness, scoring, repeat detection, SpectyraEvent ingestion.
 */
import assert from "node:assert";
import type { SpectyraEvent } from "@spectyra/event-core";
import {
  appendSpectyraEvent,
  buildExecutionGraphFromManualSteps,
  buildExecutionGraphFromSpectyraEvents,
  createEmptyExecutionGraph,
  linkSequentialSteps,
} from "../builder.js";
import {
  scoreExecutionGraph,
  detectRepeatLoopStepIds,
  aggregateMetricsForStep,
} from "../scoring.js";
import { classifyToolOutputLifecycle, hasLowValuePathBetween } from "../lifecycle.js";
import { suggestPrunableStepIds, suggestCompressibleStepIds } from "../pruning.js";
import { evaluateExecutionPolicies } from "../policies.js";
import { summarizeExecutionGraphFromSpectyraEvents } from "../summary.js";

function baseEvent(overrides: Partial<SpectyraEvent> & Pick<SpectyraEvent, "id" | "type">): SpectyraEvent {
  return {
    id: overrides.id,
    type: overrides.type,
    timestamp: overrides.timestamp ?? "2026-01-01T00:00:00.000Z",
    source: overrides.source ?? { adapterId: "test", integrationType: "sdk-wrapper" },
    sessionId: overrides.sessionId ?? "sess",
    runId: overrides.runId ?? "run1",
    stepId: overrides.stepId,
    payload: overrides.payload ?? {},
    security: overrides.security ?? {
      telemetryMode: "local",
      promptSnapshotMode: "local_only",
      localOnly: true,
    },
  };
}

// Manual sequential steps + repeat
const manual = buildExecutionGraphFromManualSteps([
  { stepId: "a", inputTokens: 100, outputTokens: 50 },
  { stepId: "b", inputTokens: 2000, outputTokens: 100, transforms: ["refpack"] },
  { stepId: "c", repeatsPriorStepId: "b", inputTokens: 80, outputTokens: 40 },
]);
assert.strictEqual(manual.stepOrder.join(","), "a,b,c");
assert.ok(manual.edges.some((e) => e.kind === "depends_on" && e.fromId === "step_b" && e.toId === "step_a"));
const scores = scoreExecutionGraph(manual);
assert.strictEqual(scores.get("c")?.classification, "likely_redundant");
assert.strictEqual(scores.get("b")?.classification, "compressible");
const prunable = suggestPrunableStepIds(manual, scores);
assert.ok(prunable.includes("c"));

const loops = detectRepeatLoopStepIds(
  buildExecutionGraphFromManualSteps([
    { stepId: "x" },
    { stepId: "y", repeatsPriorStepId: "x" },
  ]),
);
// Only one directional repeat — no loop
assert.strictEqual(loops.length, 0);

const loopGraph = createEmptyExecutionGraph();
appendSpectyraEvent(loopGraph, baseEvent({ id: "1", type: "session_started", runId: "r" }));
// simulate two steps with mutual repeats via manual edges is easier:
const loopManual = buildExecutionGraphFromManualSteps([{ stepId: "x" }, { stepId: "y" }]);
loopManual.edges.push({
  id: "e1",
  kind: "repeats",
  fromId: "step_x",
  toId: "step_y",
});
loopManual.edges.push({
  id: "e2",
  kind: "repeats",
  fromId: "step_y",
  toId: "step_x",
});
const lp = detectRepeatLoopStepIds(loopManual);
assert.strictEqual(lp.length, 1);
assert.ok(lp[0].includes("x") && lp[0].includes("y"));

// SpectyraEvent path (companion-like)
const events: SpectyraEvent[] = [
  baseEvent({ id: "s0", type: "session_started", payload: {} }),
  baseEvent({
    id: "o1",
    type: "optimization_applied",
    stepId: "hop1",
    payload: { inputTokensBefore: 400, inputTokensAfter: 200, transformsApplied: ["a"] },
  }),
  baseEvent({
    id: "p1",
    type: "provider_request_completed",
    stepId: "hop1",
    payload: { inputTokens: 200, outputTokens: 50 },
  }),
];
const fromEv = buildExecutionGraphFromSpectyraEvents(events);
assert.ok(fromEv.nodes.has("step_hop1"));
const sum = summarizeExecutionGraphFromSpectyraEvents(events);
assert.ok(sum.nodeCount >= 1);
assert.ok(sum.stepOrder.includes("hop1"));
assert.ok(typeof sum.scores["hop1"]?.classification === "string");
const agg = aggregateMetricsForStep(fromEv, "hop1");
assert.ok(agg.inputTokens >= 200);

const lc = classifyToolOutputLifecycle(
  { id: "t1", firstSeenStepId: "a", lastReferencedStepId: "c", estimatedChars: 30_000 },
  manual,
);
assert.ok(["reused", "stale", "compressible"].includes(lc.classification));

const g2 = buildExecutionGraphFromManualSteps([{ stepId: "p" }, { stepId: "q" }]);
g2.edges.push({ id: "lv", kind: "low_value_path", fromId: "step_p", toId: "step_q" });
assert.strictEqual(hasLowValuePathBetween(g2, "p", "q"), true);

const comp = suggestCompressibleStepIds(scores);
assert.ok(comp.includes("b"));

const pol = evaluateExecutionPolicies({
  graph: manual,
  scores,
  maxLowValueStepRatio: 0.01,
});
assert.ok(pol.length >= 1);

const g3 = createEmptyExecutionGraph();
appendSpectyraEvent(g3, baseEvent({ id: "x1", type: "optimization_applied", stepId: "s1", payload: {} }));
appendSpectyraEvent(g3, baseEvent({ id: "x2", type: "optimization_applied", stepId: "s2", payload: {} }));
linkSequentialSteps(g3);
assert.ok(g3.edges.some((e) => e.kind === "depends_on" && e.fromId === "step_s2" && e.toId === "step_s1"));

console.log("✅ execution-graph Phase 3 tests passed");
