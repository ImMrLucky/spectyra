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
import type { CanonicalRequest, CanonicalMessage, FlowSignals, LicenseStatus } from "@spectyra/canonical-model";
import { detectFeatures } from "@spectyra/feature-detection";
import { optimize as runPipeline, activateLicense } from "@spectyra/optimization-engine";
import {
  applyUpdate,
  learningUpdatesFromPipelineRun,
  mergeCalibrationForDetection,
  toHistoricalSignals,
} from "@spectyra/learning";
import { loadCompanionLearningProfile, saveCompanionLearningProfile } from "./learningStore.js";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface OptimizeResult {
  messages: ChatMessage[];
  inputTokensBefore: number;
  inputTokensAfter: number;
  transforms: string[];
  flowSignals: FlowSignals | null;
  licenseLimited: boolean;
  projectedSavingsIfActivated?: number;
}

function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) chars += m.role.length + m.content.length + 4;
  return Math.ceil(chars / 4);
}

function toCanonical(messages: ChatMessage[], mode: SpectyraRunMode): CanonicalRequest {
  return {
    requestId: `comp_${Date.now().toString(36)}`,
    runId: `run_${Date.now().toString(36)}`,
    mode,
    integrationType: "local-companion",
    messages: messages.map(m => ({
      role: m.role as CanonicalMessage["role"],
      text: m.content,
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
    return { messages: [...messages], inputTokensBefore, inputTokensAfter: inputTokensBefore, transforms: [], flowSignals: null, licenseLimited: false };
  }

  const learningProfile = loadCompanionLearningProfile();
  const canonical = toCanonical(messages, runMode);
  const history = toHistoricalSignals(learningProfile);
  const calibration = mergeCalibrationForDetection(learningProfile, undefined);
  const features = detectFeatures(canonical, history, calibration);
  const pipeline = runPipeline({ request: canonical, features, profile: learningProfile, licenseStatus });

  const resultMessages = fromCanonical(pipeline.optimizedRequest.messages);
  const inputTokensAfter = estimateTokens(resultMessages);

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
    licenseLimited: pipeline.licenseLimited,
    projectedSavingsIfActivated: pipeline.projectedSavingsIfActivated,
  };
}
