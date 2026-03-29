/**
 * Workflow-level policy hooks over execution graph + scores (analytics input for @spectyra/workflow-policy).
 */

import type { ExecutionGraph } from "./types.js";
import type { StepUsefulnessScore } from "./scoring.js";

export interface ExecutionPolicyInput {
  graph: ExecutionGraph;
  scores: Map<string, StepUsefulnessScore>;
  /** Max share of steps allowed as low_value + likely_redundant (0–1). */
  maxLowValueStepRatio?: number;
}

export interface ExecutionPolicyViolation {
  code: string;
  message: string;
  stepIds?: string[];
}

export function evaluateExecutionPolicies(input: ExecutionPolicyInput): ExecutionPolicyViolation[] {
  const out: ExecutionPolicyViolation[] = [];
  const order = input.graph.stepOrder;
  if (order.length === 0) return out;

  const ratio =
    [...input.scores.values()].filter(
      (s) => s.classification === "low_value" || s.classification === "likely_redundant",
    ).length / order.length;

  const maxR = input.maxLowValueStepRatio;
  if (maxR != null && ratio > maxR) {
    out.push({
      code: "high_low_value_ratio",
      message: `Low-value / redundant step ratio ${ratio.toFixed(2)} exceeds ${maxR}`,
    });
  }

  return out;
}
