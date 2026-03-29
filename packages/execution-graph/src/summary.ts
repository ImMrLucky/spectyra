/**
 * Companion / SDK JSON shape for execution-graph analytics (Phase 3).
 */

import type { SpectyraEvent } from "@spectyra/event-core";
import { buildExecutionGraphFromSpectyraEvents } from "./builder.js";
import { scoreExecutionGraph, detectRepeatLoopStepIds, type StepUsefulnessScore } from "./scoring.js";

export type ExecutionGraphSummaryPayload = {
  stepOrder: string[];
  nodeCount: number;
  edgeCount: number;
  scores: Record<string, StepUsefulnessScore>;
  repeatLoops: string[][];
};

export function summarizeExecutionGraphFromSpectyraEvents(events: SpectyraEvent[]): ExecutionGraphSummaryPayload {
  const graph = buildExecutionGraphFromSpectyraEvents(events);
  const scoresMap = scoreExecutionGraph(graph);
  const loops = detectRepeatLoopStepIds(graph);
  const scores: Record<string, StepUsefulnessScore> = {};
  for (const [k, v] of scoresMap) scores[k] = v;
  return {
    stepOrder: graph.stepOrder,
    nodeCount: graph.nodes.size,
    edgeCount: graph.edges.length,
    scores,
    repeatLoops: loops,
  };
}
