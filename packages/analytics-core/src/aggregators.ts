/**
 * Roll step analytics into session/workflow totals.
 */

import type { StepAnalyticsRecord, SessionAnalyticsRecord, SpectyraAnalyticsIntegration } from "./types.js";
import type { SpectyraRunMode, TelemetryMode, PromptSnapshotMode } from "@spectyra/core-types";
import { costSavingsUsd, pctChange } from "./calculators.js";

function uniqTransforms(steps: StepAnalyticsRecord[]): string[] {
  const s = new Set<string>();
  for (const st of steps) {
    for (const t of st.transformsApplied) s.add(t);
  }
  return [...s];
}

/**
 * Version 1 workflow savings: sum(step cost before) − sum(step cost after).
 */
export function aggregateStepsToSession(
  steps: StepAnalyticsRecord[],
  meta: {
    sessionId: string;
    runId: string;
    startedAt: string;
    endedAt?: string;
    mode: SpectyraRunMode;
    integrationType: SpectyraAnalyticsIntegration;
    appName?: string;
    workflowType?: string;
    telemetryMode: TelemetryMode;
    promptSnapshotMode: PromptSnapshotMode;
  },
): SessionAnalyticsRecord {
  if (steps.length === 0) {
    return {
      sessionId: meta.sessionId,
      runId: meta.runId,
      startedAt: meta.startedAt,
      endedAt: meta.endedAt,
      mode: meta.mode,
      integrationType: meta.integrationType,
      appName: meta.appName,
      workflowType: meta.workflowType,
      totalSteps: 0,
      totalModelCalls: 0,
      totalInputTokensBefore: 0,
      totalInputTokensAfter: 0,
      totalOutputTokens: 0,
      estimatedWorkflowCostBefore: 0,
      estimatedWorkflowCostAfter: 0,
      estimatedWorkflowSavings: 0,
      estimatedWorkflowSavingsPct: 0,
      repeatedContextTokensAvoided: 0,
      repeatedToolOutputTokensAvoided: 0,
      transformsApplied: [],
      security: {
        telemetryMode: meta.telemetryMode,
        promptSnapshotMode: meta.promptSnapshotMode,
        inferencePath: "direct_provider",
        providerBillingOwner: "customer",
      },
      syncState: "not_synced",
    };
  }

  let totalInBefore = 0;
  let totalInAfter = 0;
  let totalOut = 0;
  let costBefore = 0;
  let costAfter = 0;
  let repeatedCtx = 0;
  let repeatedTool = 0;

  for (const st of steps) {
    totalInBefore += st.inputTokensBefore;
    totalInAfter += st.inputTokensAfter;
    totalOut += st.outputTokens ?? 0;
    costBefore += st.estimatedStepCostBefore;
    costAfter += st.estimatedStepCostAfter;
    repeatedCtx += st.repeatedContextTokensAvoided ?? 0;
    repeatedTool += st.repeatedToolOutputTokensAvoided ?? 0;
  }

  const workflowSavings = costSavingsUsd(costBefore, costAfter);
  const workflowSavingsPct = pctChange(costBefore, costAfter);

  const first = steps[0];
  const last = steps[steps.length - 1];

  return {
    sessionId: meta.sessionId,
    runId: meta.runId,
    startedAt: meta.startedAt,
    endedAt: meta.endedAt,
    mode: meta.mode,
    integrationType: meta.integrationType,
    appName: meta.appName ?? first.appName,
    workflowType: meta.workflowType ?? first.workflowType,
    provider: first.provider,
    model: first.model,
    totalSteps: steps.length,
    totalModelCalls: steps.length,
    totalInputTokensBefore: totalInBefore,
    totalInputTokensAfter: totalInAfter,
    totalOutputTokens: totalOut,
    estimatedWorkflowCostBefore: costBefore,
    estimatedWorkflowCostAfter: costAfter,
    estimatedWorkflowSavings: workflowSavings,
    estimatedWorkflowSavingsPct: workflowSavingsPct,
    repeatedContextTokensAvoided: repeatedCtx,
    repeatedToolOutputTokensAvoided: repeatedTool,
    totalContextReductionPct:
      totalInBefore > 0 ? ((totalInBefore - totalInAfter) / totalInBefore) * 100 : undefined,
    transformsApplied: uniqTransforms(steps),
    success: steps.every((s) => s.success !== false),
    qualityScore: last.qualityScore ?? null,
    security: {
      telemetryMode: meta.telemetryMode,
      promptSnapshotMode: meta.promptSnapshotMode,
      inferencePath: "direct_provider",
      providerBillingOwner: "customer",
    },
    syncState: "not_synced",
  };
}
