/**
 * Step usefulness scoring — analytics / policy hints only (no automatic pruning here).
 */

import type { ExecutionGraph } from "./types.js";

export type StepUsefulnessClass =
  | "critical"
  | "useful"
  | "compressible"
  | "low_value"
  | "likely_redundant";

export interface StepUsefulnessScore {
  stepId: string;
  classification: StepUsefulnessClass;
  /** Heuristic 0–1 (higher = more valuable to keep). */
  score01: number;
  reasons: string[];
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** How many nodes declare they depend_on this node (this node is a prerequisite). */
function downstreamDependsCount(g: ExecutionGraph, nodeId: string): number {
  return g.edges.filter((e) => e.kind === "depends_on" && e.toId === nodeId).length;
}

/** Outgoing `repeats` edges (this step repeats an earlier pattern → redundancy signal). */
function outgoingRepeatsCount(g: ExecutionGraph, stepNodeId: string): number {
  return g.edges.filter((e) => e.kind === "repeats" && e.fromId === stepNodeId).length;
}

export function aggregateMetricsForStep(g: ExecutionGraph, stepId: string): {
  inputTokens: number;
  outputTokens: number;
  transformCount: number;
  success: boolean;
} {
  let inputTokens = 0;
  let outputTokens = 0;
  let transformCount = 0;
  let success = true;
  for (const n of g.nodes.values()) {
    if (n.stepId !== stepId) continue;
    const m = n.metrics;
    if (!m) continue;
    inputTokens = Math.max(inputTokens, m.inputTokens ?? 0);
    outputTokens = Math.max(outputTokens, m.outputTokens ?? 0);
    transformCount += m.transformCount ?? 0;
    if (m.success === false) success = false;
  }
  return { inputTokens, outputTokens, transformCount, success };
}

export function scoreExecutionGraph(g: ExecutionGraph): Map<string, StepUsefulnessScore> {
  const out = new Map<string, StepUsefulnessScore>();
  const lastStep = g.stepOrder[g.stepOrder.length - 1];

  for (const stepId of g.stepOrder) {
    const stepNodeId = `step_${stepId}`;
    if (!g.nodes.has(stepNodeId)) continue;

    const down = downstreamDependsCount(g, stepNodeId);
    const rep = outgoingRepeatsCount(g, stepNodeId);
    const { inputTokens, outputTokens, transformCount } = aggregateMetricsForStep(g, stepId);
    const tokens = inputTokens + outputTokens;
    const reasons: string[] = [];
    let classification: StepUsefulnessClass = "useful";

    const isTerminal = stepId === lastStep && down === 0;

    if (rep > 0) {
      classification = "likely_redundant";
      reasons.push("repeats_prior_step");
    } else if (isTerminal) {
      classification = "critical";
      reasons.push("terminal_workflow_step");
    } else if (down > 0) {
      reasons.push("downstream_dependencies");
    }

    if (
      classification === "useful" &&
      tokens > 0 &&
      tokens < 150 &&
      g.stepOrder.length > 2 &&
      !isTerminal
    ) {
      classification = "low_value";
      reasons.push("small_token_non_terminal");
    }

    if (
      classification !== "likely_redundant" &&
      transformCount > 0 &&
      inputTokens > 500 &&
      (classification === "useful" || classification === "low_value")
    ) {
      classification = "compressible";
      reasons.push("large_input_with_transforms");
    }

    const score01 = clamp01(0.25 + down * 0.12 - rep * 0.2 + Math.min(tokens / 2500, 0.35) + (isTerminal ? 0.15 : 0));
    out.set(stepId, { stepId, classification, score01, reasons });
  }

  return out;
}

/** Steps that form a simple retry loop: A repeats B and B repeats A (undirected pair). */
export function detectRepeatLoopStepIds(g: ExecutionGraph): string[][] {
  const loops: string[][] = [];
  const seen = new Set<string>();
  for (const e of g.edges) {
    if (e.kind !== "repeats") continue;
    const a = g.nodes.get(e.fromId)?.stepId;
    const b = g.nodes.get(e.toId)?.stepId;
    if (!a || !b || a === b) continue;
    const key = [a, b].sort().join("|");
    if (seen.has(key)) continue;
    const reverse = g.edges.some(
      (x) => x.kind === "repeats" && x.fromId === e.toId && x.toId === e.fromId,
    );
    if (reverse) {
      seen.add(key);
      loops.push([a, b]);
    }
  }
  return loops;
}
