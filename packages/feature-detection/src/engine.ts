/**
 * Feature detection engine.
 *
 * Runs all registered detectors against a canonical request and returns
 * a flat list of detection results sorted by confidence (descending).
 */

import type {
  CanonicalRequest,
  FeatureDetector,
  FeatureDetectionResult,
  HistoricalSignals,
} from "@spectyra/canonical-model";

import { duplicationDetectors } from "./detectors/duplication.js";
import { contextBloatDetectors } from "./detectors/context-bloat.js";
import { agentFlowDetectors } from "./detectors/agent-flow.js";
import { structuralDetectors } from "./detectors/structural.js";
import { outputConstraintDetectors } from "./detectors/output-constraints.js";
import { advancedDetectors } from "./detectors/advanced.js";

const allDetectors: FeatureDetector[] = [
  ...duplicationDetectors,
  ...contextBloatDetectors,
  ...agentFlowDetectors,
  ...structuralDetectors,
  ...outputConstraintDetectors,
  ...advancedDetectors,
];

const customDetectors: FeatureDetector[] = [];

export function registerDetector(detector: FeatureDetector): void {
  customDetectors.push(detector);
}

/**
 * Run all detectors and return the combined results.
 *
 * If `calibration` overrides are provided (from a learning profile),
 * results with confidence below the calibration threshold for their
 * featureId are filtered out.
 */
export function detectFeatures(
  request: CanonicalRequest,
  history?: HistoricalSignals,
  calibration?: Record<string, number>,
): FeatureDetectionResult[] {
  const detectors = [...allDetectors, ...customDetectors];
  const results: FeatureDetectionResult[] = [];

  for (const detector of detectors) {
    const detected = detector.detect(request, history);
    for (const result of detected) {
      const threshold = calibration?.[result.featureId] ?? 0;
      if (result.confidence >= threshold) {
        results.push(result);
      }
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}
