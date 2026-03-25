/**
 * Global learning snapshot.
 *
 * Aggregated, non-sensitive metrics used for cross-customer improvement.
 * Never stores raw prompts, responses, code, or customer identifiers.
 *
 * Allowed:  aggregate transform success, savings, quality scores, feature IDs.
 * Forbidden: raw prompts, raw responses, files, code blocks, customer PII.
 */

import type {
  GlobalLearningSnapshot,
  TransformBenchmark,
  LearningProfile,
} from "@spectyra/canonical-model";

export function createEmptySnapshot(): GlobalLearningSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    transformBenchmarks: {},
    detectorThresholdUpdates: {},
  };
}

/**
 * Aggregate multiple local profiles into a global snapshot.
 * Only uses non-sensitive aggregate metrics.
 */
export function aggregateProfiles(
  profiles: LearningProfile[],
  existingSnapshot?: GlobalLearningSnapshot,
): GlobalLearningSnapshot {
  const benchmarks: Record<string, { totalSavings: number; totalQuality: number; qualityCount: number; totalSamples: number; featureHits: Map<string, number> }> = {};

  for (const profile of profiles) {
    for (const [transformId, pref] of Object.entries(profile.transformPreferences)) {
      if (!benchmarks[transformId]) {
        benchmarks[transformId] = { totalSavings: 0, totalQuality: 0, qualityCount: 0, totalSamples: 0, featureHits: new Map() };
      }
      const b = benchmarks[transformId];
      b.totalSavings += pref.avgTokenSavings * pref.sampleCount;
      b.totalSamples += pref.sampleCount;
      if (pref.avgQualityScore != null) {
        b.totalQuality += pref.avgQualityScore * pref.sampleCount;
        b.qualityCount += pref.sampleCount;
      }
    }
  }

  const transformBenchmarks: Record<string, TransformBenchmark> = {};
  for (const [id, b] of Object.entries(benchmarks)) {
    transformBenchmarks[id] = {
      avgSavingsPct: b.totalSamples > 0 ? (b.totalSavings / b.totalSamples) : 0,
      qualityRetentionScore: b.qualityCount > 0 ? (b.totalQuality / b.qualityCount) : 0.9,
      bestForFeatures: [...b.featureHits.entries()]
        .sort((a, c) => c[1] - a[1])
        .slice(0, 5)
        .map(([f]) => f),
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    transformBenchmarks: {
      ...existingSnapshot?.transformBenchmarks,
      ...transformBenchmarks,
    },
    detectorThresholdUpdates: {
      ...existingSnapshot?.detectorThresholdUpdates,
    },
  };
}

/**
 * Look up transform defaults from the global snapshot for use as fallback
 * when no local profile data exists.
 */
export function getGlobalDefault(
  snapshot: GlobalLearningSnapshot,
  transformId: string,
): TransformBenchmark | undefined {
  return snapshot.transformBenchmarks[transformId];
}

/**
 * Look up detector threshold adjustments from the global snapshot.
 */
export function getGlobalDetectorThreshold(
  snapshot: GlobalLearningSnapshot,
  detectorId: string,
): number | undefined {
  return snapshot.detectorThresholdUpdates[detectorId];
}
