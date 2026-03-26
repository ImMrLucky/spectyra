/**
 * Cloud sync helpers — summaries only, never raw prompt content.
 */

import type { SessionAnalyticsRecord, SyncedAnalyticsPayload } from "./types.js";

export function sessionToSyncedPayload(session: SessionAnalyticsRecord): SyncedAnalyticsPayload {
  return {
    sessionId: session.sessionId,
    runId: session.runId,
    mode: session.mode,
    integrationType: session.integrationType,
    appName: session.appName,
    workflowType: session.workflowType,
    provider: session.provider,
    model: session.model,
    totalSteps: session.totalSteps,
    totalModelCalls: session.totalModelCalls,
    totalInputTokensBefore: session.totalInputTokensBefore,
    totalInputTokensAfter: session.totalInputTokensAfter,
    totalOutputTokens: session.totalOutputTokens,
    estimatedWorkflowCostBefore: session.estimatedWorkflowCostBefore,
    estimatedWorkflowCostAfter: session.estimatedWorkflowCostAfter,
    estimatedWorkflowSavings: session.estimatedWorkflowSavings,
    estimatedWorkflowSavingsPct: session.estimatedWorkflowSavingsPct,
    repeatedContextTokensAvoided: session.repeatedContextTokensAvoided,
    repeatedToolOutputTokensAvoided: session.repeatedToolOutputTokensAvoided,
    transformsApplied: session.transformsApplied,
    success: session.success,
    qualityScore: session.qualityScore ?? null,
    security: {
      telemetryMode: "cloud_redacted",
      promptSnapshotMode: session.security.promptSnapshotMode,
      inferencePath: "direct_provider",
      providerBillingOwner: "customer",
    },
  };
}
