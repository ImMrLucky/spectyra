/**
 * @spectyra/analytics-core
 *
 * Unified analytics: savings calculations, session aggregation, cloud-safe sync payloads.
 */

export * from "./types.js";
export * from "./calculators.js";
export * from "./aggregators.js";
export * from "./sync.js";
export * from "./session-tracker.js";

// Legacy: pipeline-based reports (canonical model)
import type { SavingsReport, PromptComparison } from "@spectyra/core-types";
import type { CanonicalRequest, OptimizationPipelineResult } from "@spectyra/canonical-model";

const APPROX_COST_PER_TOKEN = 0.000003;

function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function requestCharCount(req: CanonicalRequest): number {
  return req.messages.reduce((a, m) => a + (m.text?.length ?? 0), 0);
}

/**
 * Build a SavingsReport from a pipeline result.
 */
export function buildSavingsReport(pipeline: OptimizationPipelineResult): SavingsReport {
  const { originalRequest, optimizedRequest, transformsApplied } = pipeline;

  const beforeChars = requestCharCount(originalRequest);
  const afterChars = requestCharCount(optimizedRequest);
  const beforeTokens = estimateTokens(beforeChars);
  const afterTokens = estimateTokens(afterChars);
  const tokensSaved = beforeTokens - afterTokens;
  const savingsPct = beforeTokens > 0 ? Math.round((tokensSaved / beforeTokens) * 100) : 0;

  return {
    runId: originalRequest.runId,
    mode: originalRequest.mode,
    integrationType: originalRequest.integrationType,
    provider: originalRequest.provider?.vendor ?? "unknown",
    model: originalRequest.provider?.model ?? "unknown",
    inputTokensBefore: beforeTokens,
    inputTokensAfter: afterTokens,
    outputTokens: 0,
    estimatedCostBefore: beforeTokens * APPROX_COST_PER_TOKEN,
    estimatedCostAfter: afterTokens * APPROX_COST_PER_TOKEN,
    estimatedSavings: tokensSaved * APPROX_COST_PER_TOKEN,
    estimatedSavingsPct: savingsPct,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    telemetryMode: originalRequest.security.telemetryMode,
    promptSnapshotMode: originalRequest.security.promptSnapshotMode,
    transformsApplied,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Build a PromptComparison from a pipeline result.
 */
export function buildPromptComparison(pipeline: OptimizationPipelineResult): PromptComparison {
  const report = buildSavingsReport(pipeline);

  return {
    originalMessagesSummary: pipeline.originalRequest.messages.map((m) => ({
      role: m.role,
      contentPreview: (m.text ?? "").slice(0, 500),
    })),
    optimizedMessagesSummary: pipeline.optimizedRequest.messages.map((m) => ({
      role: m.role,
      contentPreview: (m.text ?? "").slice(0, 500),
    })),
    diffSummary: {
      inputTokensBefore: report.inputTokensBefore,
      inputTokensAfter: report.inputTokensAfter,
      tokensSaved: report.inputTokensBefore - report.inputTokensAfter,
      pctSaved: report.estimatedSavingsPct,
      transformsApplied: report.transformsApplied,
    },
    storageMode: pipeline.originalRequest.security.promptSnapshotMode,
    localOnly: pipeline.originalRequest.security.localOnly ?? true,
  };
}

/**
 * Aggregate multiple savings reports into a summary.
 */
export function aggregateSavings(reports: SavingsReport[]): {
  totalRuns: number;
  totalTokensSaved: number;
  totalCostSaved: number;
  avgSavingsPercent: number;
} {
  const totalRuns = reports.length;
  const totalTokensSaved = reports.reduce((a, r) => a + (r.inputTokensBefore - r.inputTokensAfter), 0);
  const totalCostSaved = reports.reduce((a, r) => a + r.estimatedSavings, 0);
  const avgSavingsPercent =
    totalRuns > 0 ? reports.reduce((a, r) => a + r.estimatedSavingsPct, 0) / totalRuns : 0;

  return { totalRuns, totalTokensSaved, totalCostSaved, avgSavingsPercent };
}
