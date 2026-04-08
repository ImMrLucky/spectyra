/**
 * Maps feature detection + flow signals into SavingsReport fields so the local
 * dashboard can show value beyond raw token deltas.
 */

import type { FeatureDetectionResult, FlowSignals } from "@spectyra/canonical-model";

/**
 * Rough token hints from detectors (duplication, tool reinclusion) for dashboard totals.
 * Not billing-grade; complements measured pipeline savings.
 */
export function estimateRepeatedTokensFromFeatures(
  features: FeatureDetectionResult[],
  inputTokensBefore: number,
): { repeatedContextTokensAvoided: number; repeatedToolOutputTokensAvoided: number } {
  let ctx = 0;
  let tool = 0;
  const base = Math.max(0, inputTokensBefore);
  for (const f of features) {
    const c = f.confidence;
    if (f.featureId === "duplication/repeated_messages" || f.featureId === "duplication/repeated_system") {
      ctx += c * base * 0.12;
    }
    if (f.featureId === "duplication/repeated_tool_outputs" || f.featureId === "agent_flow/tool_result_reinclusion") {
      tool += c * base * 0.15;
    }
  }
  return {
    repeatedContextTokensAvoided: Math.round(ctx),
    repeatedToolOutputTokensAvoided: Math.round(tool),
  };
}

export type DerivedSavingsMetrics = {
  duplicateReductionPct?: number;
  /**
   * 0–100 context stability (higher = more settled / coherent thread).
   * Persisted as SavingsReport.flowReductionPct for shared schema compatibility.
   */
  flowStabilityScore?: number;
  compressibleUnitsHint?: number;
};

function maxDupConfidence(features: FeatureDetectionResult[]): number {
  let c = 0;
  for (const f of features) {
    const id = f.featureId;
    if (
      id.startsWith("duplication/") ||
      id.startsWith("agent_flow/") ||
      id.startsWith("structural/repeated")
    ) {
      c = Math.max(c, f.confidence);
    }
  }
  return c;
}

/**
 * Derive duplicate-pattern score and flow stability from engine outputs.
 */
export function deriveSavingsMetrics(
  features: FeatureDetectionResult[],
  flowSignals: FlowSignals | null,
): DerivedSavingsMetrics {
  const dup = maxDupConfidence(features);
  const duplicateReductionPct = dup > 0 ? Math.round(dup * 1000) / 10 : undefined;

  if (!flowSignals) {
    return { duplicateReductionPct, flowStabilityScore: undefined, compressibleUnitsHint: undefined };
  }

  const flowStabilityScore = Math.round(flowSignals.stabilityIndex * 1000) / 10;
  const compressibleUnitsHint =
    flowSignals.compressibleMessageCount > 0 ? flowSignals.compressibleMessageCount : undefined;

  return {
    duplicateReductionPct,
    flowStabilityScore,
    compressibleUnitsHint,
  };
}
