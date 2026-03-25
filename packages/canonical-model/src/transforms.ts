/**
 * Optimization transform types.
 *
 * Transforms operate on canonical requests + detected features.
 * They must NOT reference vendor or tool names.
 */

import type { CanonicalRequest } from "./request.js";
import type { FeatureDetectionResult } from "./features.js";
import type { LearningProfile } from "./learning.js";

// ── Transform context ────────────────────────────────────────────────────────

export interface TransformContext {
  features: FeatureDetectionResult[];
  profile?: LearningProfile;
  /** Transforms already applied in this pipeline. */
  appliedTransformIds?: string[];
}

// ── Transform result ─────────────────────────────────────────────────────────

export type TransformRiskLevel = "low" | "medium" | "high";

export interface TransformResult {
  request: CanonicalRequest;
  applied: boolean;
  notes: string[];
  estimatedTokenDelta?: number;
  riskLevel?: TransformRiskLevel;
}

// ── Transform interface ──────────────────────────────────────────────────────

export interface OptimizationTransform {
  /** Unique identifier for this transform. */
  id: string;

  /**
   * Returns true if this transform should run, based on detected features
   * and the current request state.
   */
  applies(
    features: FeatureDetectionResult[],
    request: CanonicalRequest,
    profile?: LearningProfile,
  ): boolean;

  /** Execute the transform, returning the (possibly modified) request. */
  run(request: CanonicalRequest, context: TransformContext): TransformResult;
}

// ── Flow signals ─────────────────────────────────────────────────────────────

export type FlowRecommendation = "reuse" | "expand" | "ask_clarify";

export interface FlowSignals {
  /** Spectral recommendation: whether context is stable (reuse), needs more
   *  info (expand), or has contradictions that need resolution (ask_clarify). */
  recommendation: FlowRecommendation;

  /** Overall context stability [0, 1]. Higher = more stable/compressible. */
  stabilityIndex: number;

  /** Fiedler value — algebraic connectivity of the semantic graph. */
  lambda2: number;

  /** Fraction of graph weight that is contradictory [0, 1]. */
  contradictionEnergy: number;

  /** True when the system detects conflicting instructions or facts. */
  hasContradictions: boolean;

  /** Human-readable contradiction descriptions (if any). */
  contradictionSummaries: string[];

  /** True when the conversation appears stuck in an error/retry loop. */
  isStuckLoop: boolean;

  /** Summary of what the system considers settled context. */
  stableContextSummary: string | null;

  /** Number of messages that can safely be dropped or compressed. */
  compressibleMessageCount: number;

  /** Suggested clarification text when recommendation is ask_clarify. */
  suggestedClarification: string | null;

  /** Path detected: "talk" for conversation, "code" for dev workflows. */
  detectedPath: "talk" | "code";
}

// ── License status ───────────────────────────────────────────────────────────

export type LicenseStatus =
  | "active"       // Valid trial or paid — full optimization applied
  | "observe_only" // No valid license — full pipeline runs but nothing applied
  | "unknown";     // License check hasn't run yet

// ── Engine output ────────────────────────────────────────────────────────────

export interface OptimizationPipelineResult {
  originalRequest: CanonicalRequest;

  /**
   * The optimized request.
   * - licensed ("active"): contains the actual optimized messages
   * - unlicensed ("observe_only"): identical to originalRequest (nothing applied)
   */
  optimizedRequest: CanonicalRequest;

  /** Transforms that were (or would be) applied. */
  transformsApplied: string[];

  /** Token savings achieved (licensed) or projected (unlicensed). */
  projectedTokenSavings: number;

  riskAnnotations: Array<{ transformId: string; risk: TransformRiskLevel; note: string }>;
  featuresDetected: FeatureDetectionResult[];

  /** Flow optimization signals — always computed for all users so
   *  unlicensed users can see the intelligence they'd get. */
  flowSignals: FlowSignals | null;

  /** License status that determined this result. */
  licenseStatus: LicenseStatus;

  /**
   * True when the user has no valid license. The full pipeline ran
   * so the user can SEE what they'd save, but zero optimization was
   * actually applied. Callers should show an activation prompt.
   */
  licenseLimited: boolean;

  /**
   * Estimated cost savings in USD that the user would get if they
   * activated. Only set when licenseLimited is true.
   */
  projectedSavingsIfActivated?: number;
}
