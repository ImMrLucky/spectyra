/**
 * Shared report contracts consumed by the SDK, Desktop App, and Website App.
 */

import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  InferencePath,
  ProviderBillingOwner,
  IntegrationType,
} from "./modes.js";

/**
 * Universal savings report emitted after every Spectyra-wrapped call
 * (or observe simulation).  Both the SDK and the Local Companion produce
 * this shape; the Website App renders it from cloud-synced analytics.
 */
export interface SavingsReport {
  runId: string;
  mode: SpectyraRunMode;
  integrationType: IntegrationType;

  provider: string;
  model: string;

  inputTokensBefore: number;
  inputTokensAfter: number;
  outputTokens: number;

  estimatedCostBefore: number;
  estimatedCostAfter: number;
  estimatedSavings: number;
  estimatedSavingsPct: number;

  contextReductionPct?: number;
  duplicateReductionPct?: number;
  flowReductionPct?: number;

  telemetryMode: TelemetryMode;
  promptSnapshotMode: PromptSnapshotMode;
  inferencePath: InferencePath;
  providerBillingOwner: ProviderBillingOwner;

  transformsApplied: string[];

  success?: boolean;
  qualityScore?: number | null;
  notes?: string[];

  createdAt?: string;
}

/**
 * Before/after prompt comparison stored locally by default.
 * Consumers can render a diff UI or disable storage entirely.
 */
export interface PromptComparison {
  originalMessagesSummary: unknown;
  optimizedMessagesSummary: unknown;

  diffSummary: {
    inputTokensBefore: number;
    inputTokensAfter: number;
    tokensSaved: number;
    pctSaved: number;
    transformsApplied: string[];
  };

  storageMode: PromptSnapshotMode;
  localOnly: boolean;
}
