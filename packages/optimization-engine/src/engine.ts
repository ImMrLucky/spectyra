/**
 * Full optimization engine.
 *
 * ALL 45+ core algorithms run locally in-process.
 * ZERO customer data leaves the customer's environment.
 *
 * License model:
 *   - Valid trial or paid license → full optimization applied, all efficiencies
 *   - No valid license → observe-only: full pipeline RUNS so the user can SEE
 *     what they'd save, but zero optimization is applied. Original messages
 *     are always returned. This drives conversion — show the value, prompt
 *     the user to activate.
 *
 * This module must NEVER import adapter modules or reference vendor/tool names.
 */

import type {
  CanonicalRequest,
  FeatureDetectionResult,
  LearningProfile,
  OptimizationTransform,
  OptimizationPipelineResult,
  TransformContext,
  TransformRiskLevel,
  FlowSignals,
  FlowRecommendation,
  LicenseStatus,
} from "@spectyra/canonical-model";
import { shouldSkipTransformForLearning } from "@spectyra/learning";

import { whitespaceNormalize } from "./transforms/whitespace-normalize.js";
import { dedupConsecutive } from "./transforms/dedup-consecutive.js";
import { assistantSelfQuoteDedup } from "./transforms/assistant-self-quote-dedup.js";
import { systemDedup } from "./transforms/system-dedup.js";
import { toolOutputTruncate } from "./transforms/tool-output-truncate.js";
import { jsonMinify } from "./transforms/json-minify.js";
import { errorStackCompressor } from "./transforms/error-stack-compressor.js";
import { contextWindowTrim } from "./transforms/context-window-trim.js";
import { stableTurnSummarize } from "./transforms/stable-turn-summarize.js";
import { spectralSCC } from "./transforms/spectral-scc.js";
import { refpackTransform } from "./transforms/refpack-transform.js";
import { phrasebookTransform } from "./transforms/phrasebook-transform.js";
import { codemapTransform } from "./transforms/codemap-transform.js";
import { deltaPromptingTransform } from "./transforms/delta-prompting.js";
import { codeSlicerTransform } from "./transforms/code-slicer.js";
import { patchModeTransform } from "./transforms/patch-mode.js";

import {
  unitizeMessages,
  buildGraph,
  spectralAnalyze,
  countRecentFailingSignals,
  detectRepeatingErrorCodes,
  type ChatMsg,
  type PathKind,
  type SpectralOptions,
} from "@spectyra/optimizer-algorithms";

// ── Transform pipeline ───────────────────────────────────────────────────────

const fullTransformPipeline: OptimizationTransform[] = [
  whitespaceNormalize,
  dedupConsecutive,
  assistantSelfQuoteDedup,
  systemDedup,
  toolOutputTruncate,
  jsonMinify,
  errorStackCompressor,
  codeSlicerTransform,
  spectralSCC,
  deltaPromptingTransform,
  patchModeTransform,
  refpackTransform,
  phrasebookTransform,
  codemapTransform,
  stableTurnSummarize,
  contextWindowTrim,
];

const customTransforms: OptimizationTransform[] = [];

export function registerTransform(transform: OptimizationTransform): void {
  customTransforms.push(transform);
}

// ── License state ────────────────────────────────────────────────────────────

let _licenseStatus: LicenseStatus = "unknown";
let _licenseKey: string | null = null;

/**
 * Activate the engine with a valid license key (trial or paid).
 * Once active, the full pipeline applies real optimizations.
 */
export function activateLicense(licenseKey: string): boolean {
  if (!licenseKey || licenseKey.length < 8) {
    _licenseStatus = "observe_only";
    _licenseKey = null;
    return false;
  }
  _licenseKey = licenseKey;
  _licenseStatus = "active";
  return true;
}

export function deactivateLicense(): void {
  _licenseStatus = "observe_only";
  _licenseKey = null;
}

export function getLicenseStatus(): LicenseStatus {
  return _licenseStatus;
}

// ── Token estimation ─────────────────────────────────────────────────────────

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function requestTokenEstimate(req: CanonicalRequest): number {
  let chars = 0;
  for (const m of req.messages) chars += (m.text?.length ?? 0);
  return Math.ceil(chars / 4);
}

// ── Flow signals ─────────────────────────────────────────────────────────────

const DEFAULT_SPECTRAL_OPTS: SpectralOptions = {
  tLow: 0.3,
  tHigh: 0.65,
  maxNodes: 50,
  similarityEdgeMin: 0.85,
  contradictionEdgeWeight: -0.8,
};

function detectPath(req: CanonicalRequest): PathKind {
  if (req.policies?.desiredOutputShape === "code") return "code";
  const lastUser = [...req.messages].reverse().find(m => m.role === "user");
  if (!lastUser?.text) return "talk";
  const t = lastUser.text.toLowerCase();
  if (
    t.includes("code") || t.includes("function") || t.includes("implement") ||
    t.includes("fix") || t.includes("bug") || t.includes("error") ||
    t.includes("typescript") || t.includes("compile")
  ) return "code";
  return "talk";
}

function computeFlowSignals(request: CanonicalRequest): FlowSignals {
  const chatMsgs: ChatMsg[] = request.messages.map(m => ({
    role: m.role,
    content: m.text ?? "",
  }));

  const path = detectPath(request);

  const units = unitizeMessages({
    path,
    messages: chatMsgs,
    lastTurnIndex: request.messages.length,
    opts: { maxUnits: 50, minChunkChars: 40, maxChunkChars: 900, includeSystem: false },
  });

  if (units.length < 2) {
    return {
      recommendation: "expand",
      stabilityIndex: 0.5,
      lambda2: 0,
      contradictionEnergy: 0,
      hasContradictions: false,
      contradictionSummaries: [],
      isStuckLoop: false,
      stableContextSummary: null,
      compressibleMessageCount: 0,
      suggestedClarification: null,
      detectedPath: path,
    };
  }

  const graph = buildGraph({ path, units, opts: DEFAULT_SPECTRAL_OPTS });
  const spectral = spectralAnalyze({
    graph,
    opts: DEFAULT_SPECTRAL_OPTS,
    units,
    currentTurn: request.messages.length,
  });

  const recommendation: FlowRecommendation =
    spectral.recommendation === "REUSE" ? "reuse" :
    spectral.recommendation === "ASK_CLARIFY" ? "ask_clarify" :
    "expand";

  const hasContradictions = spectral.contradictionEnergy > 0.2;
  const contradictionSummaries: string[] = [];
  if (hasContradictions) {
    const contradictionEdges = graph.edges.filter(e => e.type === "contradiction" && e.w < -0.3);
    for (const edge of contradictionEdges.slice(0, 3)) {
      const unitA = units[edge.i];
      const unitB = units[edge.j];
      if (unitA && unitB) {
        contradictionSummaries.push(
          `Conflicting: "${unitA.text.slice(0, 60)}…" vs "${unitB.text.slice(0, 60)}…"`
        );
      }
    }
  }

  const recentFailures = countRecentFailingSignals(chatMsgs, 12);
  const repeatingCodes = detectRepeatingErrorCodes(chatMsgs);
  const isStuckLoop = recentFailures >= 3 || repeatingCodes.length >= 2;

  const stableUnits = spectral.stableNodeIdx.map(i => units[i]).filter(Boolean);
  const stableContextSummary = stableUnits.length > 0
    ? stableUnits.slice(0, 5).map(u => u!.text.slice(0, 80)).join(" | ")
    : null;

  const compressibleMessageCount = Math.max(0,
    request.messages.length - (spectral.lambda2 < 0.12 ? 4 : 8)
  );

  let suggestedClarification: string | null = null;
  if (recommendation === "ask_clarify") {
    if (isStuckLoop) {
      suggestedClarification = "The conversation appears stuck in a retry loop. Consider a different approach or clarify the exact requirement.";
    } else if (hasContradictions) {
      suggestedClarification = "Conflicting instructions detected. Please clarify which requirement takes priority.";
    } else {
      suggestedClarification = "The context is ambiguous. Could you clarify your intent?";
    }
  }

  return {
    recommendation,
    stabilityIndex: spectral.stabilityIndex,
    lambda2: spectral.lambda2,
    contradictionEnergy: spectral.contradictionEnergy,
    hasContradictions,
    contradictionSummaries,
    isStuckLoop,
    stableContextSummary,
    compressibleMessageCount,
    suggestedClarification,
    detectedPath: path,
  };
}

// ── Run pipeline (internal) ──────────────────────────────────────────────────

interface PipelineRunResult {
  optimizedRequest: CanonicalRequest;
  appliedIds: string[];
  riskAnnotations: Array<{ transformId: string; risk: TransformRiskLevel; note: string }>;
}

function runTransformPipeline(
  request: CanonicalRequest,
  features: FeatureDetectionResult[],
  profile?: LearningProfile,
): PipelineRunResult {
  const transforms = [...fullTransformPipeline, ...customTransforms];
  let current = request;
  const appliedIds: string[] = [];
  const riskAnnotations: Array<{ transformId: string; risk: TransformRiskLevel; note: string }> = [];

  for (const transform of transforms) {
    if (shouldSkipTransformForLearning(transform.id, profile)) continue;
    if (!transform.applies(features, current, profile)) continue;

    const ctx: TransformContext = {
      features,
      profile,
      appliedTransformIds: [...appliedIds],
    };

    const result = transform.run(current, ctx);
    if (result.applied) {
      appliedIds.push(transform.id);
      current = result.request;
      if (result.riskLevel && result.riskLevel !== "low") {
        riskAnnotations.push({
          transformId: transform.id,
          risk: result.riskLevel,
          note: result.notes.join("; "),
        });
      }
    }
  }

  return { optimizedRequest: current, appliedIds, riskAnnotations };
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface OptimizeInput {
  request: CanonicalRequest;
  features: FeatureDetectionResult[];
  profile?: LearningProfile;
  /** Override the global license state for this call. */
  licenseStatus?: LicenseStatus;
}

/**
 * Run the optimization pipeline.
 *
 * ALL processing happens locally in-process. Zero customer data
 * leaves the customer's environment.
 *
 * Licensed (trial or paid):
 *   - Full pipeline runs and optimizations are APPLIED
 *   - Flow signals returned
 *   - licenseLimited = false
 *
 * Unlicensed (expired / no account):
 *   - Full pipeline runs so the user can SEE projected savings
 *   - But optimizedRequest === originalRequest (nothing applied)
 *   - Flow signals still returned (show the intelligence)
 *   - licenseLimited = true → caller shows activation prompt
 *   - projectedSavingsIfActivated set
 */
export function optimize(input: OptimizeInput): OptimizationPipelineResult {
  const { request, features, profile } = input;
  const licenseStatus = input.licenseStatus ?? _licenseStatus;
  const isLicensed = licenseStatus === "active";

  const originalTokens = requestTokenEstimate(request);
  const flowSignals = computeFlowSignals(request);

  if (request.mode === "off" && isLicensed) {
    return {
      originalRequest: request,
      optimizedRequest: request,
      transformsApplied: [],
      projectedTokenSavings: 0,
      riskAnnotations: [],
      featuresDetected: features,
      flowSignals,
      licenseStatus,
      licenseLimited: false,
    };
  }

  // Always run the full pipeline — licensed users get real savings,
  // unlicensed users see what they COULD save.
  const pipelineResult = runTransformPipeline(request, features, profile);
  const optimizedTokens = requestTokenEstimate(pipelineResult.optimizedRequest);
  const tokenSavings = originalTokens - optimizedTokens;

  if (isLicensed) {
    // Licensed + mode "on": apply pipeline output (mode "off" handled above).
    return {
      originalRequest: request,
      optimizedRequest: pipelineResult.optimizedRequest,
      transformsApplied: pipelineResult.appliedIds,
      projectedTokenSavings: tokenSavings,
      riskAnnotations: pipelineResult.riskAnnotations,
      featuresDetected: features,
      flowSignals,
      licenseStatus: "active",
      licenseLimited: false,
    };
  }

  // ── Unlicensed: observe-only, show what they'd save ──
  // Full pipeline ran, but we return originalRequest unchanged.
  // The user sees the projected savings and can activate to get them.
  return {
    originalRequest: request,
    optimizedRequest: request, // NEVER apply optimizations without license
    transformsApplied: pipelineResult.appliedIds,
    projectedTokenSavings: tokenSavings,
    riskAnnotations: pipelineResult.riskAnnotations,
    featuresDetected: features,
    flowSignals,
    licenseStatus: licenseStatus === "unknown" ? "observe_only" : licenseStatus,
    licenseLimited: true,
    projectedSavingsIfActivated: tokenSavings,
  };
}
