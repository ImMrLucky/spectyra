/**
 * Feature + flow hints for SavingsReport — mirrors Local Companion reportMetrics.
 */

import type { FeatureDetectionResult, FlowSignals } from "@spectyra/canonical-model";

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

export function deriveSavingsMetrics(
  features: FeatureDetectionResult[],
  flowSignals: FlowSignals | null,
): {
  duplicateReductionPct?: number;
  flowStabilityScore?: number;
  compressibleUnitsHint?: number;
} {
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
