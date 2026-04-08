/**
 * Local optimization engine.
 *
 * ALL optimization runs in-process. ZERO customer data leaves the environment.
 *
 * License model:
 *   - Valid trial or paid → full optimization applied, all efficiencies
 *   - No valid license → observe-only: full pipeline runs so user SEES
 *     projected savings, but zero optimization is applied.
 */

import type { SpectyraRunMode } from "@spectyra/core-types";
import type {
  CanonicalRequest,
  CanonicalMessage,
  FeatureDetectionResult,
  FlowSignals,
  LicenseStatus,
} from "@spectyra/canonical-model";
import { detectFeatures } from "@spectyra/feature-detection";
import { optimize as runPipeline, activateLicense } from "@spectyra/optimization-engine";
import {
  applyUpdate,
  learningUpdatesFromPipelineRun,
  mergeCalibrationForDetection,
  toHistoricalSignals,
} from "@spectyra/learning";
import { loadCompanionLearningProfile, saveCompanionLearningProfile } from "./learningStore.js";
import { mergeOptimizedCanonicalIntoChatMessages } from "./toolThreadMerge.js";
import { estimateRepeatedTokensFromFeatures } from "./reportMetrics.js";

/**
 * OpenAI-compatible chat message (incl. tool calling).
 * `content` may be null when an assistant message only has `tool_calls`.
 */
export interface ChatMessage {
  role: string;
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

export type OptimizationSkippedReason = "run_mode_off" | "tool_merge_failed";

export interface OptimizeResult {
  messages: ChatMessage[];
  inputTokensBefore: number;
  inputTokensAfter: number;
  transforms: string[];
  flowSignals: FlowSignals | null;
  /** Feature detectors (duplication, agent flow, etc.) — empty when optimization was skipped. */
  features: FeatureDetectionResult[];
  /** Messages in this request (for “turns” / depth metrics). */
  messageCount: number;
  licenseLimited: boolean;
  projectedSavingsIfActivated?: number;
  /** When set, the pipeline did not transform messages (before/after tokens match). */
  optimizationSkippedReason?: OptimizationSkippedReason;
  repeatedContextTokensAvoided?: number;
  repeatedToolOutputTokensAvoided?: number;
}

function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    chars += m.role.length + 4 + (m.content?.length ?? 0);
    if (m.tool_calls != null) chars += JSON.stringify(m.tool_calls).length;
    if (m.tool_call_id) chars += m.tool_call_id.length;
  }
  return Math.ceil(chars / 4);
}

/** OpenAI tool-calling thread (tool role, tool_calls, etc.). */
function hasOpenAiToolThread(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) =>
      m.role === "tool" ||
      m.tool_call_id != null ||
      (m.role === "assistant" && m.tool_calls != null),
  );
}

function toCanonical(messages: ChatMessage[], mode: SpectyraRunMode): CanonicalRequest {
  return {
    requestId: `comp_${Date.now().toString(36)}`,
    runId: `run_${Date.now().toString(36)}`,
    mode,
    integrationType: "local-companion",
    messages: messages.map(m => ({
      role: m.role as CanonicalMessage["role"],
      text: m.content ?? "",
    })),
    execution: {},
    security: {
      telemetryMode: "local",
      promptSnapshotMode: "local_only",
      localOnly: true,
      contentExfiltration: "never",
    },
  };
}

function fromCanonical(msgs: CanonicalMessage[]): ChatMessage[] {
  return msgs.map(m => ({ role: m.role, content: m.text ?? "" }));
}

export function optimize(messages: ChatMessage[], runMode: SpectyraRunMode, licenseKey?: string): OptimizeResult {
  const inputTokensBefore = estimateTokens(messages);

  const licenseStatus: LicenseStatus = licenseKey
    ? (activateLicense(licenseKey) ? "active" : "observe_only")
    : "observe_only";

  if (runMode === "off" && licenseStatus === "active") {
    return {
      messages: [...messages],
      inputTokensBefore,
      inputTokensAfter: inputTokensBefore,
      transforms: [],
      flowSignals: null,
      features: [],
      messageCount: messages.length,
      licenseLimited: false,
      optimizationSkippedReason: "run_mode_off",
      repeatedContextTokensAvoided: 0,
      repeatedToolOutputTokensAvoided: 0,
    };
  }

  const learningProfile = loadCompanionLearningProfile();
  const canonical = toCanonical(messages, runMode);
  const history = toHistoricalSignals(learningProfile);
  const calibration = mergeCalibrationForDetection(learningProfile, undefined);
  const features = detectFeatures(canonical, history, calibration);
  const pipeline = runPipeline({ request: canonical, features, profile: learningProfile, licenseStatus });

  const repeatedEst = estimateRepeatedTokensFromFeatures(features, inputTokensBefore);
  const toolThread = hasOpenAiToolThread(messages);

  let resultMessages: ChatMessage[];
  let mergeFailed = false;

  if (toolThread) {
    const optCanon = pipeline.optimizedRequest.messages;
    if (optCanon.length !== messages.length) {
      resultMessages = messages.map((m) => ({ ...m }));
      mergeFailed = true;
    } else {
      resultMessages = mergeOptimizedCanonicalIntoChatMessages(messages, optCanon);
    }
  } else {
    resultMessages = fromCanonical(pipeline.optimizedRequest.messages);
  }

  let inputTokensAfter = estimateTokens(resultMessages);

  const projected = Math.max(0, pipeline.projectedTokenSavings);
  const useProjectedMetrics =
    pipeline.licenseLimited ||
    (licenseStatus === "active" && runMode === "observe") ||
    (toolThread && mergeFailed);

  if (useProjectedMetrics && projected > 0) {
    inputTokensAfter = Math.max(0, inputTokensBefore - projected);
  }

  const tokensSaved = Math.max(0, inputTokensBefore - inputTokensAfter);
  const updates = learningUpdatesFromPipelineRun({
    scopeId: learningProfile.scopeId,
    appliedTransformIds: pipeline.transformsApplied,
    tokensSaved,
    featureIds: features.map((f) => f.featureId),
    success: true,
  });
  for (const u of updates) applyUpdate(learningProfile, u);
  saveCompanionLearningProfile(learningProfile);

  return {
    messages: resultMessages,
    inputTokensBefore,
    inputTokensAfter,
    transforms: pipeline.transformsApplied,
    flowSignals: pipeline.flowSignals,
    features,
    messageCount: messages.length,
    licenseLimited: pipeline.licenseLimited,
    projectedSavingsIfActivated: pipeline.projectedSavingsIfActivated,
    repeatedContextTokensAvoided: repeatedEst.repeatedContextTokensAvoided,
    repeatedToolOutputTokensAvoided: repeatedEst.repeatedToolOutputTokensAvoided,
    optimizationSkippedReason: mergeFailed ? "tool_merge_failed" : undefined,
  };
}
