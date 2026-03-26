/**
 * Unified analytics & savings types (SDK, Local Companion, Desktop, cloud sync).
 */

import type {
  InferencePath,
  IntegrationType,
  PromptSnapshotMode,
  ProviderBillingOwner,
  SpectyraRunMode,
  TelemetryMode,
} from "@spectyra/core-types";

/** Alias — same as SpectyraRunMode. */
export type SpectyraAnalyticsMode = SpectyraRunMode;

/** Alias — same as TelemetryMode. */
export type SpectyraTelemetryMode = TelemetryMode;

/** Narrow integration labels used in analytics payloads (subset of IntegrationType). */
export type SpectyraAnalyticsIntegration =
  | "sdk-wrapper"
  | "local-companion"
  | "observe-preview";

export type AnalyticsSyncState = "not_synced" | "queued" | "synced" | "sync_failed";

export type StepAnalyticsRecord = {
  stepId: string;
  sessionId: string;
  runId: string;

  timestamp: string;

  mode: SpectyraAnalyticsMode;
  integrationType: SpectyraAnalyticsIntegration;

  appName?: string;
  workflowType?: string;
  provider?: string;
  model?: string;

  stepIndex?: number;

  inputTokensBefore: number;
  inputTokensAfter: number;
  outputTokens?: number;

  estimatedInputCostBefore: number;
  estimatedInputCostAfter: number;
  estimatedOutputCost?: number;

  estimatedStepCostBefore: number;
  estimatedStepCostAfter: number;
  estimatedStepSavings: number;
  estimatedStepSavingsPct: number;

  repeatedContextTokensAvoided?: number;
  repeatedToolOutputTokensAvoided?: number;
  contextReductionPct?: number;
  duplicateReductionPct?: number;

  transformsApplied: string[];

  latencyMs?: number;
  success?: boolean;
  qualityScore?: number | null;

  security: {
    telemetryMode: SpectyraTelemetryMode;
    promptSnapshotMode: PromptSnapshotMode;
    inferencePath: InferencePath;
    providerBillingOwner: ProviderBillingOwner;
  };

  /** Client-side sync metadata (optional). */
  syncState?: AnalyticsSyncState;
};

export type SessionAnalyticsRecord = {
  sessionId: string;
  runId: string;

  startedAt: string;
  endedAt?: string;

  mode: SpectyraAnalyticsMode;
  integrationType: SpectyraAnalyticsIntegration;

  appName?: string;
  workflowType?: string;
  provider?: string;
  model?: string;

  totalSteps: number;
  totalModelCalls: number;

  totalInputTokensBefore: number;
  totalInputTokensAfter: number;
  totalOutputTokens: number;

  estimatedWorkflowCostBefore: number;
  estimatedWorkflowCostAfter: number;
  estimatedWorkflowSavings: number;
  estimatedWorkflowSavingsPct: number;

  repeatedContextTokensAvoided: number;
  repeatedToolOutputTokensAvoided: number;
  totalContextReductionPct?: number;
  totalDuplicateReductionPct?: number;

  retriesAvoided?: number;
  estimatedAvoidedCalls?: number | null;

  transformsApplied: string[];
  success?: boolean;
  qualityScore?: number | null;

  security: {
    telemetryMode: SpectyraTelemetryMode;
    promptSnapshotMode: PromptSnapshotMode;
    inferencePath: InferencePath;
    providerBillingOwner: ProviderBillingOwner;
  };

  syncState?: AnalyticsSyncState;
};

export type PromptComparisonRef = {
  runId: string;
  stepId?: string;
  available: boolean;
  storageMode: "none" | "local_only" | "cloud_opt_in";
  localPathOrKey?: string;
};

export type AnalyticsEvent =
  | { type: "session_started"; session: SessionAnalyticsRecord }
  | { type: "step_completed"; step: StepAnalyticsRecord }
  | { type: "session_updated"; session: SessionAnalyticsRecord }
  | { type: "session_finished"; session: SessionAnalyticsRecord };

/** Cloud-safe payload (no raw prompts/responses). */
export type SyncedAnalyticsPayload = {
  sessionId: string;
  runId: string;
  mode: SpectyraAnalyticsMode;
  integrationType: SpectyraAnalyticsIntegration;

  appName?: string;
  workflowType?: string;
  provider?: string;
  model?: string;

  totalSteps: number;
  totalModelCalls: number;

  totalInputTokensBefore: number;
  totalInputTokensAfter: number;
  totalOutputTokens: number;

  estimatedWorkflowCostBefore: number;
  estimatedWorkflowCostAfter: number;
  estimatedWorkflowSavings: number;
  estimatedWorkflowSavingsPct: number;

  repeatedContextTokensAvoided: number;
  repeatedToolOutputTokensAvoided: number;

  transformsApplied: string[];

  success?: boolean;
  qualityScore?: number | null;

  security: {
    telemetryMode: "cloud_redacted";
    promptSnapshotMode: PromptSnapshotMode;
    inferencePath: "direct_provider";
    providerBillingOwner: "customer";
  };
};

export type { IntegrationType, SpectyraRunMode, TelemetryMode, PromptSnapshotMode };
