/**
 * Local direct-provider wrapper.
 *
 * ALL optimization runs in-process on the customer's machine.
 * ZERO customer data leaves the customer's environment.
 * Provider calls go directly to the provider using the customer's own key.
 *
 * License model:
 *   - Valid trial or paid license → full optimization applied, all efficiencies
 *   - No valid license → observe-only: full pipeline runs so the user can SEE
 *     what they'd save, but zero optimization is applied. Original unoptimized
 *     messages go to the provider. The result includes licenseLimited = true
 *     so the caller can show an activation prompt.
 */

import type { ChatMessage } from "../sharedTypes.js";
import type {
  SpectyraConfig,
  SpectyraCompleteInput,
  SpectyraCompleteResult,
  ProviderAdapter,
} from "../types.js";
import type {
  SpectyraRunMode,
  TelemetryMode,
  PromptSnapshotMode,
  SavingsReport,
  PromptComparison,
} from "@spectyra/core-types";
import type {
  CanonicalRequest,
  CanonicalMessage,
  FlowSignals,
  LicenseStatus,
} from "@spectyra/canonical-model";
import { detectFeatures } from "@spectyra/feature-detection";
import { optimize, activateLicense } from "@spectyra/optimization-engine";
import { estimateCost } from "./tokenEstimator.js";

/**
 * Run a provider call wrapped with Spectyra optimization logic.
 * Everything runs locally in-process. No data leaves the customer environment.
 */
export async function localComplete<TClient, TResult>(
  config: SpectyraConfig,
  input: SpectyraCompleteInput<TClient>,
  adapter: ProviderAdapter<TClient, TResult>,
): Promise<SpectyraCompleteResult<TResult>> {
  const runMode: SpectyraRunMode = config.runMode ?? "observe";
  const telemetryMode: TelemetryMode = config.telemetry?.mode ?? "local";
  const promptSnapshotMode: PromptSnapshotMode = config.promptSnapshots ?? "local_only";
  const runId = crypto.randomUUID();
  const originalMessages = input.messages;

  // Activate license if provided — determines full vs observe-only
  const licenseStatus: LicenseStatus = config.licenseKey
    ? (activateLicense(config.licenseKey) ? "active" : "observe_only")
    : "observe_only";

  if (runMode === "off" && licenseStatus === "active") {
    const { result, usage } = await adapter.call({
      client: input.client,
      model: input.model,
      messages: originalMessages,
      maxTokens: input.maxTokens,
      temperature: input.temperature,
    });

    return buildResult({
      runId, runMode, provider: input.provider, model: input.model,
      inputTokensBefore: charEstimate(originalMessages),
      inputTokensAfter: charEstimate(originalMessages),
      outputTokens: usage.outputTokens,
      transformsApplied: [],
      telemetryMode, promptSnapshotMode,
      providerResult: result,
      flowSignals: null,
      licenseLimited: false,
      licenseStatus: "active",
    });
  }

  // Run the full pipeline — the engine handles license gating internally:
  // licensed = real optimizations applied, unlicensed = observe-only
  const canonicalReq = toCanonical(runId, runMode, input, telemetryMode, promptSnapshotMode);
  const features = detectFeatures(canonicalReq);
  const pipeline = optimize({
    request: canonicalReq,
    features,
    licenseStatus,
  });

  // The engine already enforces: unlicensed → optimizedRequest === originalRequest
  const messagesToSend = fromCanonicalMessages(pipeline.optimizedRequest.messages);

  const { result, usage } = await adapter.call({
    client: input.client,
    model: input.model,
    messages: messagesToSend,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
  });

  return buildResult({
    runId, runMode, provider: input.provider, model: input.model,
    inputTokensBefore: charEstimate(originalMessages),
    inputTokensAfter: charEstimate(messagesToSend),
    outputTokens: usage.outputTokens,
    transformsApplied: pipeline.transformsApplied,
    telemetryMode, promptSnapshotMode,
    providerResult: result,
    originalMessages,
    optimizedMessages: messagesToSend,
    flowSignals: pipeline.flowSignals,
    licenseLimited: pipeline.licenseLimited,
    licenseStatus: pipeline.licenseStatus,
    projectedSavingsIfActivated: pipeline.projectedSavingsIfActivated,
  });
}

// ---------------------------------------------------------------------------
// Canonical model bridge
// ---------------------------------------------------------------------------

function toCanonical(
  runId: string,
  mode: SpectyraRunMode,
  input: SpectyraCompleteInput,
  telemetryMode: TelemetryMode,
  promptSnapshotMode: PromptSnapshotMode,
): CanonicalRequest {
  return {
    requestId: `req_${runId}`,
    runId,
    mode,
    integrationType: "sdk-wrapper",
    provider: { vendor: input.provider, model: input.model },
    messages: input.messages.map(m => ({
      role: m.role as CanonicalMessage["role"],
      text: m.content,
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
  return msgs.map(m => ({
    role: m.role as ChatMessage["role"],
    content: m.text ?? "",
  }));
}

function charEstimate(messages: ChatMessage[]): number {
  let n = 0;
  for (const m of messages) n += Math.ceil(m.content.length / 4);
  return n;
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
}

function buildResult<TResult>(input: BuildResultInput<TResult>): SpectyraCompleteResult<TResult> {
  const costBefore = estimateCost(input.provider, input.model, input.inputTokensBefore, input.outputTokens);
  const costAfter = estimateCost(input.provider, input.model, input.inputTokensAfter, input.outputTokens);
  const savings = costBefore - costAfter;
  const savingsPct = costBefore > 0 ? (savings / costBefore) * 100 : 0;
  const tokensSaved = input.inputTokensBefore - input.inputTokensAfter;
  const pctTokensSaved = input.inputTokensBefore > 0
    ? (tokensSaved / input.inputTokensBefore) * 100
    : 0;

  const report: SavingsReport = {
    runId: input.runId,
    mode: input.runMode,
    integrationType: "sdk-wrapper",
    provider: input.provider,
    model: input.model,
    inputTokensBefore: input.inputTokensBefore,
    inputTokensAfter: input.inputTokensAfter,
    outputTokens: input.outputTokens,
    estimatedCostBefore: costBefore,
    estimatedCostAfter: costAfter,
    estimatedSavings: input.licenseLimited ? 0 : savings,
    estimatedSavingsPct: input.licenseLimited ? 0 : savingsPct,
    contextReductionPct: input.licenseLimited ? undefined : (pctTokensSaved > 0 ? pctTokensSaved : undefined),
    telemetryMode: input.telemetryMode,
    promptSnapshotMode: input.promptSnapshotMode,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: input.transformsApplied,
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
        inputTokensAfter: input.inputTokensAfter,
        tokensSaved,
        pctSaved: pctTokensSaved,
        transformsApplied: input.transformsApplied,
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
    contentLength: m.content.length,
    contentPreview: m.content.slice(0, 100),
  }));
}
