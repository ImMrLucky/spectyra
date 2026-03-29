/**
 * Build learning updates from an optimization run (for applyUpdate).
 */

import type { GlobalLearningSnapshot, LearningProfile, LearningUpdate } from "@spectyra/canonical-model";
import { getDetectorCalibration } from "./local-profile.js";

/**
 * Merge detector minimum-confidence thresholds: global defaults, overridden by local profile.
 */
export function mergeCalibrationForDetection(
  profile?: LearningProfile,
  global?: GlobalLearningSnapshot,
): Record<string, number> | undefined {
  const g = global?.detectorThresholdUpdates ?? {};
  const p = profile ? getDetectorCalibration(profile) : {};
  const merged: Record<string, number> = { ...g, ...p };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

export function learningUpdatesFromPipelineRun(input: {
  scopeId: string;
  appliedTransformIds: string[];
  tokensSaved: number;
  featureIds: string[];
  success: boolean;
  qualityScore?: number;
  timestamp?: string;
}): LearningUpdate[] {
  const ts = input.timestamp ?? new Date().toISOString();
  const n = input.appliedTransformIds.length;
  const per = n > 0 ? Math.max(0, input.tokensSaved) / n : 0;
  return input.appliedTransformIds.map((transformId) => ({
    scopeId: input.scopeId,
    transformId,
    success: input.success,
    tokensSaved: per,
    qualityScore: input.qualityScore,
    featureIds: input.featureIds,
    timestamp: ts,
  }));
}
