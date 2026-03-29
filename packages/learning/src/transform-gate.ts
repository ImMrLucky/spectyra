/**
 * Skip expensive / risky transforms when local learning shows persistent failure.
 * Baseline transforms (whitespace, dedup, trim) are never muted here.
 */

import type { LearningProfile } from "@spectyra/canonical-model";

/** Transforms that may be skipped when local stats are strongly negative. */
export const TRANSFORMS_SUBJECT_TO_LEARNING_GATE = new Set<string>([
  "spectral_scc",
  "refpack",
  "phrasebook",
  "codemap",
  "stable_turn_summarize",
]);

export type LearningGateOptions = {
  /** Minimum samples before muting (default 8). */
  minSamples?: number;
  /** Mute when successRate is at or below this (default 0.12). */
  maxSuccessRateToMute?: number;
};

/**
 * Returns true if the pipeline should not run this transform, based on local profile only.
 */
export function shouldSkipTransformForLearning(
  transformId: string,
  profile: LearningProfile | undefined,
  opts?: LearningGateOptions,
): boolean {
  if (!profile || !TRANSFORMS_SUBJECT_TO_LEARNING_GATE.has(transformId)) return false;
  const minSamples = opts?.minSamples ?? 8;
  const maxSr = opts?.maxSuccessRateToMute ?? 0.12;
  const pref = profile.transformPreferences[transformId];
  if (!pref || pref.sampleCount < minSamples) return false;
  return pref.successRate <= maxSr;
}
