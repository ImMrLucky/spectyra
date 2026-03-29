/**
 * Client-safe optimization engine (for web/browser only).
 *
 * The web app (Spectyra's Angular dashboard) uses this for displaying
 * the optimization UI. It has NO core IP — the web app calls the
 * Spectyra API server for actual optimization.
 *
 * SDK, Desktop, and Companion do NOT use this package. They use the
 * full @spectyra/optimization-engine which runs everything locally.
 */

import type {
  CanonicalRequest,
  FeatureDetectionResult,
  GlobalLearningSnapshot,
  LearningProfile,
  OptimizationPipelineResult,
  TransformRiskLevel,
} from "@spectyra/canonical-model";

function requestTokenEstimate(req: CanonicalRequest): number {
  let chars = 0;
  for (const m of req.messages) chars += (m.text?.length ?? 0);
  return Math.ceil(chars / 4);
}

export interface OptimizeClientInput {
  request: CanonicalRequest;
  features: FeatureDetectionResult[];
  profile?: LearningProfile;
  globalLearningSnapshot?: GlobalLearningSnapshot;
}

/**
 * Stub pipeline for the web app. Returns the request unchanged.
 * The web app should call the API server for real optimization.
 */
export function optimizeClient(input: OptimizeClientInput): OptimizationPipelineResult {
  const { request, features } = input;

  return {
    originalRequest: request,
    optimizedRequest: request,
    transformsApplied: [],
    projectedTokenSavings: 0,
    riskAnnotations: [],
    featuresDetected: features,
    flowSignals: null,
    licenseStatus: "unknown",
    licenseLimited: true,
  };
}
