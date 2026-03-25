/**
 * Learning system types.
 *
 * Two scopes:
 * - Local: per-app, per-workflow, per-install. Richer data, stays local.
 * - Global: aggregated, non-sensitive. Used for cross-customer improvement.
 */

// ── Local learning ───────────────────────────────────────────────────────────

export interface TransformPreference {
  successRate: number;
  avgTokenSavings: number;
  avgQualityScore?: number;
  sampleCount: number;
}

export interface StablePatternSummary {
  patternHash: string;
  description: string;
  occurrences: number;
  lastSeenAt: string;
}

export interface LearningProfile {
  /** Scope this profile applies to (app ID, workflow ID, install ID, etc.). */
  scopeId: string;
  /** Per-transform success rates and savings metrics. */
  transformPreferences: Record<string, TransformPreference>;
  /** Repeated structural patterns detected over time. */
  stablePatterns?: StablePatternSummary[];
  /** Per-detector confidence calibration overrides. */
  detectorCalibration?: Record<string, number>;
}

// ── Global learning ──────────────────────────────────────────────────────────

export interface TransformBenchmark {
  avgSavingsPct: number;
  qualityRetentionScore: number;
  bestForFeatures: string[];
}

export interface GlobalLearningSnapshot {
  generatedAt: string;
  transformBenchmarks: Record<string, TransformBenchmark>;
  detectorThresholdUpdates: Record<string, number>;
}

// ── Learning update ──────────────────────────────────────────────────────────

export interface LearningUpdate {
  scopeId: string;
  transformId: string;
  success: boolean;
  tokensSaved: number;
  qualityScore?: number;
  featureIds: string[];
  timestamp: string;
}
