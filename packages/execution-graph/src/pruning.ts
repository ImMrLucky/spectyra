/**
 * Pruning suggestions only — host must apply policy before mutating prompts/state.
 */

import type { ExecutionGraph } from "./types.js";
import type { StepUsefulnessScore } from "./scoring.js";

export type PruningMode = "off" | "suggest_only";

export function suggestPrunableStepIds(
  _graph: ExecutionGraph,
  scores: Map<string, StepUsefulnessScore>,
  mode: PruningMode = "suggest_only",
): string[] {
  if (mode === "off") return [];
  return [...scores.entries()]
    .filter(([, s]) => s.classification === "likely_redundant")
    .map(([id]) => id);
}

export function isLikelyRedundant(score: StepUsefulnessScore | undefined): boolean {
  return score?.classification === "likely_redundant";
}

/** Steps that are safe to *consider* for compression transforms (not drop). */
export function suggestCompressibleStepIds(scores: Map<string, StepUsefulnessScore>): string[] {
  return [...scores.entries()]
    .filter(([, s]) => s.classification === "compressible" || s.classification === "low_value")
    .map(([id]) => id);
}
