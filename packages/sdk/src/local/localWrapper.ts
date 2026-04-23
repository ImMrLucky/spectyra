/**
 * Local direct-provider wrapper.
 *
 * ALL optimization runs in-process on the customer's machine.
 * ZERO customer data leaves the customer's environment.
 * Provider calls go directly to the provider using the customer's own key.
 *
 * Parity with Local Companion optimizer:
 * - OpenAI tool threads: merge optimized text onto original rows (preserve tool_calls).
 * - Licensed + tool-merge-fail: projected token savings on the report.
 * - SavingsReport hints: duplicate / flow / repeated-context estimates.
 * - Optional spectyra/* model resolution via defaultAliasModels + overrides.
 */

import type { ChatMessage } from "../sharedTypes.js";
import type {
  SpectyraConfig,
  SpectyraCompleteInput,
  SpectyraCompleteResult,
  ProviderAdapter,
} from "../types.js";
import {
  type SpectyraRunMode,
  type TelemetryMode,
  type PromptSnapshotMode,
  type SavingsReport,
  type PromptComparison,
  normalizeSpectyraRunMode,
} from "@spectyra/core-types";
import type {
  CanonicalRequest,
  CanonicalMessage,
  FlowSignals,
  LicenseStatus,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";
import { detectFeatures } from "@spectyra/feature-detection";
import { optimize, activateLicense } from "@spectyra/optimization-engine";
import {
  applyUpdate,
  learningUpdatesFromPipelineRun,
  mergeCalibrationForDetection,
  toHistoricalSignals,
} from "@spectyra/learning";
import { defaultAliasModels, resolveSpectyraModel } from "@spectyra/shared";
import { estimateCost } from "./tokenEstimator.js";
import { estimateTokensFromMessages } from "./tokenEstimate.js";
import { hasOpenAiToolThread, mergeOptimizedCanonicalIntoChatMessages } from "./toolThreadMerge.js";
import { deriveSavingsMetrics, estimateRepeatedTokensFromFeatures } from "./featureReportHints.js";
import { emitSdkEventsForStandaloneComplete, sdkEventEngine } from "../events/sdkEvents.js";
import { evaluateWorkflowPolicyFromEvents } from "../workflow/sdkWorkflowPolicyFromEvents.js";
import { WorkflowPolicyBlockedError } from "../workflow/WorkflowPolicyBlockedError.js";

function assertWorkflowPolicyAllows(config: SpectyraConfig): void {
  const wp = config.workflowPolicy;
  if (!wp) return;
  const policy = evaluateWorkflowPolicyFromEvents(sdkEventEngine.snapshot(), wp.mode);
  if (policy.shouldBlock) {
    throw new WorkflowPolicyBlockedError(policy);
  }
}

function isSpectyraModelAlias(model: string): boolean {
  const t = model.trim();
  return t.startsWith("spectyra/") || t === "smart" || t === "fast" || t === "quality";
}

function resolveUpstreamProviderModel(
  config: SpectyraConfig,
  input: SpectyraCompleteInput,
): { provider: string; model: string } {
  if (!isSpectyraModelAlias(input.model)) {
    return { provider: input.provider, model: input.model };
  }
  const defaults = defaultAliasModels(input.provider);
  const o = config.spectyraModelAliasOverrides ?? {};
  const r = resolveSpectyraModel(input.model, {
    provider: input.provider,
    aliasSmartModel: o.aliasSmartModel ?? defaults.smart,
    aliasFastModel: o.aliasFastModel ?? defaults.fast,
    aliasQualityModel: o.aliasQualityModel ?? defaults.quality,
    providerTierModels: o.providerTierModels,
  });
  return { provider: r.provider, model: r.upstreamModel };
}

/**
 * Run a provider call wrapped with Spectyra optimization logic.
 * Everything runs locally in-process. No data leaves the customer environment.
 */
export async function localComplete<TClient, TResult>(
  config: SpectyraConfig,
  input: SpectyraCompleteInput<TClient>,
  adapter: ProviderAdapter<TClient, TResult>,
): Promise<SpectyraCompleteResult<TResult>> {
  const runMode: SpectyraRunMode = normalizeSpectyraRunMode(config.runMode, "on");
  const telemetryMode: TelemetryMode = config.telemetry?.mode ?? "local";
  const promptSnapshotMode: PromptSnapshotMode = config.promptSnapshots ?? "local_only";
  const runId = input.runContext?.runId?.trim() || crypto.randomUUID();
  const originalMessages = input.messages;
  const { provider: resolvedProvider, model: resolvedModel } = resolveUpstreamProviderModel(config, input);

  const licenseStatus: LicenseStatus = config.licenseKey
    ? (activateLicense(config.licenseKey) ? "active" : "observe_only")
    : "observe_only";

  if (runMode === "off") {
    assertWorkflowPolicyAllows(config);
    const { result, usage } = await adapter.call({
      client: input.client,
      model: resolvedModel,
      messages: originalMessages,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    });

    const licenseLimited = licenseStatus !== "active";
    return buildResult({
      runId,
      runMode,
      provider: resolvedProvider,
      model: resolvedModel,
      inputTokensBefore: estimateTokensFromMessages(originalMessages),
      inputTokensAfter: estimateTokensFromMessages(originalMessages),
      outputTokens: usage.outputTokens,
      transformsApplied: [],
      telemetryMode,
      promptSnapshotMode,
      providerResult: result,
      flowSignals: null,
      licenseLimited,
      licenseStatus,
      sessionId: input.runContext?.sessionId,
    });
  }

  const canonicalReq = toCanonical(
    runId,
    runMode,
    input,
    resolvedProvider,
    resolvedModel,
    telemetryMode,
    promptSnapshotMode,
  );
  const profile = config.learningProfile;
  const features = detectFeatures(
    canonicalReq,
    profile ? toHistoricalSignals(profile) : undefined,
    mergeCalibrationForDetection(profile, config.globalLearningSnapshot),
  );
  const pipeline = optimize({
    request: canonicalReq,
    features,
    profile,
    licenseStatus,
  });

  const projected = Math.max(0, pipeline.projectedTokenSavings);
  const toolThread = hasOpenAiToolThread(originalMessages);
  let messagesToSend: ChatMessage[];
  let mergeFailed = false;

  if (toolThread) {
    const optCanon = pipeline.optimizedRequest.messages;
    if (optCanon.length !== originalMessages.length) {
      messagesToSend = originalMessages.map((m) => ({ ...m }));
      mergeFailed = true;
    } else {
      messagesToSend = mergeOptimizedCanonicalIntoChatMessages(originalMessages, optCanon);
    }
  } else {
    messagesToSend = fromCanonicalMessages(pipeline.optimizedRequest.messages);
  }

  let inputTokensBefore = estimateTokensFromMessages(originalMessages);
  let inputTokensAfter = estimateTokensFromMessages(messagesToSend);

  const useProjectedMetrics = !pipeline.licenseLimited && (toolThread && mergeFailed);

  if (useProjectedMetrics && projected > 0) {
    inputTokensAfter = Math.max(0, inputTokensBefore - projected);
  }

  const optimizationSkippedReason = mergeFailed ? ("tool_merge_failed" as const) : undefined;

  assertWorkflowPolicyAllows(config);

  if (profile) {
    const tokensSaved = Math.max(0, inputTokensBefore - inputTokensAfter);
    const updates = learningUpdatesFromPipelineRun({
      scopeId: profile.scopeId,
      appliedTransformIds: pipeline.transformsApplied,
      tokensSaved,
      featureIds: features.map((f) => f.featureId),
      success: true,
    });
    for (const u of updates) applyUpdate(profile, u);
  }

  const { result, usage } = await adapter.call({
    client: input.client,
    model: resolvedModel,
    messages: messagesToSend,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  });

  const out = buildResult({
    runId,
    runMode,
    provider: resolvedProvider,
    model: resolvedModel,
    inputTokensBefore,
    inputTokensAfter,
    outputTokens: usage.outputTokens,
    transformsApplied: pipeline.transformsApplied,
    telemetryMode,
    promptSnapshotMode,
    providerResult: result,
    originalMessages,
    optimizedMessages: messagesToSend,
    flowSignals: pipeline.flowSignals,
    licenseLimited: pipeline.licenseLimited,
    licenseStatus: pipeline.licenseStatus,
    projectedSavingsIfActivated: pipeline.projectedSavingsIfActivated,
    features,
    optimizationSkippedReason,
    sessionId: input.runContext?.sessionId,
  });
  emitSdkEventsForStandaloneComplete(telemetryMode, input, out);
  return out;
}

// ---------------------------------------------------------------------------
// Canonical model bridge
// ---------------------------------------------------------------------------

function toCanonical(
  runId: string,
  mode: SpectyraRunMode,
  input: SpectyraCompleteInput,
  resolvedProvider: string,
  resolvedModel: string,
  telemetryMode: TelemetryMode,
  promptSnapshotMode: PromptSnapshotMode,
): CanonicalRequest {
  return {
    requestId: `req_${runId}`,
    runId,
    mode,
    integrationType: "sdk-wrapper",
    provider: { vendor: resolvedProvider, model: resolvedModel },
    messages: input.messages.map((m) => ({
      role: m.role as CanonicalMessage["role"],
      text: m.content ?? "",
    })),
    execution: {
      appName: input.runContext?.appName,
      workflowType: input.runContext?.workflowType,
    },
    security: {
      telemetryMode,
      promptSnapshotMode,
      localOnly: true,
      contentExfiltration: "never",
    },
  };
}

function fromCanonicalMessages(msgs: CanonicalMessage[]): ChatMessage[] {
  return msgs.map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.text ?? "",
  }));
}

// ---------------------------------------------------------------------------
// Build result
// ---------------------------------------------------------------------------

interface BuildResultInput<TResult> {
  runId: string;
  runMode: SpectyraRunMode;
  provider: string;
  model: string;
  inputTokensBefore: number;
  inputTokensAfter: number;
  outputTokens: number;
  transformsApplied: string[];
  telemetryMode: TelemetryMode;
  promptSnapshotMode: PromptSnapshotMode;
  providerResult: TResult;
  originalMessages?: ChatMessage[];
  optimizedMessages?: ChatMessage[];
  flowSignals?: FlowSignals | null;
  licenseLimited: boolean;
  licenseStatus: LicenseStatus;
  projectedSavingsIfActivated?: number;
  features?: FeatureDetectionResult[];
  optimizationSkippedReason?: "tool_merge_failed";
  sessionId?: string;
}

function buildResult<TResult>(input: BuildResultInput<TResult>): SpectyraCompleteResult<TResult> {
  const reportInputTokensAfter = input.licenseLimited ? input.inputTokensBefore : input.inputTokensAfter;
  const costBefore = estimateCost(input.provider, input.model, input.inputTokensBefore, input.outputTokens);
  const costAfter = estimateCost(input.provider, input.model, reportInputTokensAfter, input.outputTokens);
  const savings = costBefore - costAfter;
  const savingsPct = costBefore > 0 ? (savings / costBefore) * 100 : 0;
  const tokensSaved = input.licenseLimited ? 0 : Math.max(0, input.inputTokensBefore - reportInputTokensAfter);
  const pctTokensSaved = input.inputTokensBefore > 0
    ? (tokensSaved / input.inputTokensBefore) * 100
    : 0;

  const reportTransforms = input.licenseLimited ? [] : input.transformsApplied;
  const feats = input.features ?? [];
  const derived = input.licenseLimited
    ? { duplicateReductionPct: undefined, flowStabilityScore: undefined, compressibleUnitsHint: undefined }
    : deriveSavingsMetrics(feats, input.flowSignals ?? null);
  const repeated = input.licenseLimited
    ? { repeatedContextTokensAvoided: 0, repeatedToolOutputTokensAvoided: 0 }
    : estimateRepeatedTokensFromFeatures(feats, input.inputTokensBefore);

  const notes: string[] = [];
  if (input.optimizationSkippedReason === "tool_merge_failed") {
    notes.push(
      "Tool thread: structural optimization changed message count — original messages sent; savings shown are projected.",
    );
  }
  if (input.licenseLimited) {
    notes.push(
      "No paid/trial license: provider received full messages. Add a Spectyra license key to apply optimizations.",
    );
  }
  if (input.flowSignals?.isStuckLoop && !input.licenseLimited) {
    notes.push("Flow: retry / error-loop pattern detected — consider clarifying the task or trimming context.");
  }

  const report: SavingsReport = {
    runId: input.runId,
    mode: input.runMode,
    integrationType: "sdk-wrapper",
    sessionId: input.sessionId,
    provider: input.provider,
    model: input.model,
    inputTokensBefore: input.inputTokensBefore,
    inputTokensAfter: reportInputTokensAfter,
    outputTokens: input.outputTokens,
    estimatedCostBefore: costBefore,
    estimatedCostAfter: costAfter,
    estimatedSavings: input.licenseLimited ? 0 : savings,
    estimatedSavingsPct: input.licenseLimited ? 0 : savingsPct,
    contextReductionPct: input.licenseLimited ? undefined : (pctTokensSaved > 0 ? pctTokensSaved : undefined),
    duplicateReductionPct: derived.duplicateReductionPct,
    flowReductionPct: derived.flowStabilityScore,
    messageTurnCount: input.licenseLimited ? undefined : (input.originalMessages?.length ?? undefined),
    compressibleUnitsHint: derived.compressibleUnitsHint,
    repeatedContextTokensAvoided: repeated.repeatedContextTokensAvoided,
    repeatedToolOutputTokensAvoided: repeated.repeatedToolOutputTokensAvoided,
    telemetryMode: input.telemetryMode,
    promptSnapshotMode: input.promptSnapshotMode,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: reportTransforms,
    notes: notes.length > 0 ? notes : undefined,
    success: true,
    createdAt: new Date().toISOString(),
  };

  let promptComparison: PromptComparison | undefined;
  if (input.originalMessages && input.optimizedMessages && input.promptSnapshotMode !== "none") {
    promptComparison = {
      originalMessagesSummary: summarizeMessages(input.originalMessages),
      optimizedMessagesSummary: summarizeMessages(input.optimizedMessages),
      diffSummary: {
        inputTokensBefore: input.inputTokensBefore,
        inputTokensAfter: reportInputTokensAfter,
        tokensSaved,
        pctSaved: pctTokensSaved,
        transformsApplied: reportTransforms,
      },
      storageMode: input.promptSnapshotMode,
      localOnly: input.promptSnapshotMode === "local_only",
    };
  }

  return {
    providerResult: input.providerResult,
    report,
    promptComparison,
    flowSignals: input.flowSignals ?? null,
    licenseLimited: input.licenseLimited,
    licenseStatus: input.licenseStatus,
    projectedSavingsIfActivated: input.projectedSavingsIfActivated,
    security: {
      inferencePath: "direct_provider",
      providerBillingOwner: "customer",
      telemetryMode: input.telemetryMode,
      promptSnapshotMode: input.promptSnapshotMode,
      cloudRelay: "none",
    },
  };
}

function summarizeMessages(messages: ChatMessage[]): unknown {
  return messages.map((m) => ({
    role: m.role,
    contentLength: (m.content ?? "").length,
    contentPreview: (m.content ?? "").slice(0, 100),
  }));
}
