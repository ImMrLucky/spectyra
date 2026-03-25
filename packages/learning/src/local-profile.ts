/**
 * Local learning profile management.
 *
 * Stores per-app/per-workflow/per-install learning data locally.
 * Allowed to use richer data because it never leaves the customer environment.
 */

import type {
  LearningProfile,
  LearningUpdate,
  TransformPreference,
  StablePatternSummary,
  HistoricalSignals,
} from "@spectyra/canonical-model";

export function createEmptyProfile(scopeId: string): LearningProfile {
  return {
    scopeId,
    transformPreferences: {},
    stablePatterns: [],
    detectorCalibration: {},
  };
}

/**
 * Apply a learning update to a local profile.
 * Uses exponential moving average for success rate and savings.
 */
export function applyUpdate(
  profile: LearningProfile,
  update: LearningUpdate,
): LearningProfile {
  const existing = profile.transformPreferences[update.transformId];
  const alpha = 0.2;

  if (!existing) {
    profile.transformPreferences[update.transformId] = {
      successRate: update.success ? 1 : 0,
      avgTokenSavings: update.tokensSaved,
      avgQualityScore: update.qualityScore,
      sampleCount: 1,
    };
  } else {
    const updated: TransformPreference = {
      successRate: existing.successRate * (1 - alpha) + (update.success ? 1 : 0) * alpha,
      avgTokenSavings: existing.avgTokenSavings * (1 - alpha) + update.tokensSaved * alpha,
      sampleCount: existing.sampleCount + 1,
    };
    if (update.qualityScore != null) {
      updated.avgQualityScore = (existing.avgQualityScore ?? 0.8) * (1 - alpha) + update.qualityScore * alpha;
    }
    profile.transformPreferences[update.transformId] = updated;
  }

  return profile;
}

/**
 * Record a stable pattern observed over time.
 */
export function recordStablePattern(
  profile: LearningProfile,
  patternHash: string,
  description: string,
): LearningProfile {
  if (!profile.stablePatterns) profile.stablePatterns = [];

  const existing = profile.stablePatterns.find(p => p.patternHash === patternHash);
  if (existing) {
    existing.occurrences++;
    existing.lastSeenAt = new Date().toISOString();
  } else {
    profile.stablePatterns.push({
      patternHash,
      description,
      occurrences: 1,
      lastSeenAt: new Date().toISOString(),
    });
  }
  return profile;
}

/**
 * Derive historical signals from a learning profile for use in feature detection.
 */
export function toHistoricalSignals(profile: LearningProfile): HistoricalSignals {
  const transformSuccessRates: Record<string, number> = {};
  let totalSamples = 0;
  let totalSavings = 0;

  for (const [id, pref] of Object.entries(profile.transformPreferences)) {
    transformSuccessRates[id] = pref.successRate;
    totalSamples += pref.sampleCount;
    totalSavings += pref.avgTokenSavings * pref.sampleCount;
  }

  return {
    priorRunCount: totalSamples,
    avgSavingsPct: totalSamples > 0 ? totalSavings / totalSamples : 0,
    frequentFeatures: (profile.stablePatterns ?? [])
      .filter(p => p.occurrences > 3)
      .map(p => p.description),
    transformSuccessRates,
  };
}

/**
 * Get detector confidence calibration from the profile.
 * Transforms with low success should have their related detectors
 * calibrated to require higher confidence before triggering.
 */
export function getDetectorCalibration(
  profile: LearningProfile,
): Record<string, number> {
  return { ...profile.detectorCalibration };
}

/**
 * Adjust a detector's calibration threshold based on transform feedback.
 */
export function calibrateDetector(
  profile: LearningProfile,
  detectorId: string,
  threshold: number,
): LearningProfile {
  if (!profile.detectorCalibration) profile.detectorCalibration = {};
  profile.detectorCalibration[detectorId] = Math.max(0, Math.min(1, threshold));
  return profile;
}
