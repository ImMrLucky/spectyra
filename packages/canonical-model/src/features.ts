/**
 * Feature detection types.
 *
 * Feature detectors operate on the canonical request and historical signals.
 * They must NOT use vendor/tool names as the primary decision path.
 */

import type { CanonicalRequest } from "./request.js";

// ── Detection result ─────────────────────────────────────────────────────────

export type FeatureSeverity = "low" | "medium" | "high";

export interface FeatureDetectionResult {
  featureId: string;
  confidence: number;
  severity?: FeatureSeverity;
  evidence?: string[];
  metrics?: Record<string, number>;
}

// ── Detector categories ──────────────────────────────────────────────────────

export type DetectorCategory =
  | "duplication"
  | "context_bloat"
  | "agent_flow"
  | "structural"
  | "safety_constraints"
  | "output_constraints";

// ── Historical signals (fed back from learning) ─────────────────────────────

export interface HistoricalSignals {
  /** Number of prior runs in this scope. */
  priorRunCount?: number;
  /** Average savings percentage achieved in this scope. */
  avgSavingsPct?: number;
  /** Features that have been detected frequently in this scope. */
  frequentFeatures?: string[];
  /** Transform success rates from the learning profile. */
  transformSuccessRates?: Record<string, number>;
}

// ── Detector interface ───────────────────────────────────────────────────────

export interface FeatureDetector {
  /** Unique identifier for this detector. */
  id: string;
  /** Category this detector belongs to. */
  category: DetectorCategory;
  /** Run detection on a canonical request, optionally using historical signals. */
  detect(
    input: CanonicalRequest,
    history?: HistoricalSignals,
  ): FeatureDetectionResult[];
}
