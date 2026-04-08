/**
 * Token, cost, and savings calculations (shared across SDK & companion).
 */

import type { SavingsReport } from "@spectyra/core-types";
import type { SpectyraAnalyticsIntegration, StepAnalyticsRecord } from "./types.js";

/** Default USD per 1K input tokens when provider pricing is unknown (conservative). */
export const DEFAULT_INPUT_COST_PER_1K = 0.003;

/** Rough output-token multiplier vs input cost (varies by model; v1 conservative). */
export const DEFAULT_OUTPUT_COST_PER_1K = 0.015;

export type PricingInput = {
  /** USD per 1M input tokens */
  inputPer1M?: number;
  /** USD per 1M output tokens */
  outputPer1M?: number;
};

const pricingTable: Record<string, PricingInput> = {
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4.1-mini": { inputPer1M: 0.4, outputPer1M: 1.6 },
  "claude-3-5-sonnet-latest": { inputPer1M: 3, outputPer1M: 15 },
  "claude-3-5-haiku-latest": { inputPer1M: 0.8, outputPer1M: 4 },
};

function resolvePricing(model: string | undefined): PricingInput {
  if (!model) return { inputPer1M: DEFAULT_INPUT_COST_PER_1K * 1000, outputPer1M: DEFAULT_OUTPUT_COST_PER_1K * 1000 };
  const hit = pricingTable[model] ?? pricingTable[model.split("/").pop() ?? ""];
  return hit ?? { inputPer1M: DEFAULT_INPUT_COST_PER_1K * 1000, outputPer1M: DEFAULT_OUTPUT_COST_PER_1K * 1000 };
}

export function estimateInputCostUsd(tokens: number, model?: string): number {
  const p = resolvePricing(model);
  return (tokens / 1_000_000) * (p.inputPer1M ?? DEFAULT_INPUT_COST_PER_1K * 1000);
}

export function estimateOutputCostUsd(tokens: number, model?: string): number {
  const p = resolvePricing(model);
  return (tokens / 1_000_000) * (p.outputPer1M ?? DEFAULT_OUTPUT_COST_PER_1K * 1000);
}

export function tokenSavings(inputBefore: number, inputAfter: number): number {
  return Math.max(0, inputBefore - inputAfter);
}

export function pctChange(before: number, after: number): number {
  if (before <= 0) return 0;
  return ((before - after) / before) * 100;
}

export function costSavingsUsd(costBefore: number, costAfter: number): number {
  return Math.max(0, costBefore - costAfter);
}

/**
 * Build a step record from a SavingsReport (single LLM / optimization unit).
 */
export function stepFromSavingsReport(
  report: SavingsReport,
  ids: { sessionId: string; runId: string; stepId: string },
  opts: {
    stepIndex: number;
    integrationType: SpectyraAnalyticsIntegration;
    appName?: string;
    workflowType?: string;
    repeatedContextTokensAvoided?: number;
    repeatedToolOutputTokensAvoided?: number;
  },
): StepAnalyticsRecord {
  const model = report.model;
  const inBefore = report.inputTokensBefore;
  const inAfter = report.inputTokensAfter;
  const outTok = report.outputTokens ?? 0;

  const estInBefore = estimateInputCostUsd(inBefore, model);
  const estInAfter = estimateInputCostUsd(inAfter, model);
  const estOut = estimateOutputCostUsd(outTok, model);

  const stepCostBefore =
    report.estimatedCostBefore > 0 ? report.estimatedCostBefore : estInBefore + estOut;
  const stepCostAfter =
    report.estimatedCostAfter > 0 ? report.estimatedCostAfter : estInAfter + estOut;
  const savings = costSavingsUsd(stepCostBefore, stepCostAfter);
  const savingsPct = pctChange(stepCostBefore, stepCostAfter);

  return {
    stepId: ids.stepId,
    sessionId: ids.sessionId,
    runId: ids.runId,
    timestamp: report.createdAt ?? new Date().toISOString(),
    mode: report.mode,
    integrationType: opts.integrationType,
    appName: opts.appName,
    workflowType: opts.workflowType,
    provider: report.provider,
    model,
    stepIndex: opts.stepIndex,
    inputTokensBefore: inBefore,
    inputTokensAfter: inAfter,
    outputTokens: outTok,
    estimatedInputCostBefore: estInBefore,
    estimatedInputCostAfter: estInAfter,
    estimatedOutputCost: estOut,
    estimatedStepCostBefore: stepCostBefore,
    estimatedStepCostAfter: stepCostAfter,
    estimatedStepSavings: savings,
    estimatedStepSavingsPct: savingsPct,
    repeatedContextTokensAvoided: opts.repeatedContextTokensAvoided ?? report.repeatedContextTokensAvoided,
    repeatedToolOutputTokensAvoided: opts.repeatedToolOutputTokensAvoided ?? report.repeatedToolOutputTokensAvoided,
    contextReductionPct: report.contextReductionPct,
    duplicateReductionPct: report.duplicateReductionPct,
    transformsApplied: report.transformsApplied ?? [],
    success: report.success ?? true,
    qualityScore: report.qualityScore ?? null,
    security: {
      telemetryMode: report.telemetryMode,
      promptSnapshotMode: report.promptSnapshotMode,
      inferencePath: report.inferencePath,
      providerBillingOwner: report.providerBillingOwner,
    },
    syncState: "not_synced",
  };
}
