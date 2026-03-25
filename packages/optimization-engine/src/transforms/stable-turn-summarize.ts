/**
 * Stable turn summarization transform.
 *
 * When older conversation turns are structurally stable (not recently
 * referenced), replaces them with compact summaries. Preserves recent
 * turns and system messages.
 */

import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
  LearningProfile,
} from "@spectyra/canonical-model";

const MIN_STABLE_CHARS = 500;
const SUMMARY_MAX_CHARS = 200;

function summarizeText(text: string): string {
  if (text.length <= SUMMARY_MAX_CHARS) return text;
  return text.slice(0, SUMMARY_MAX_CHARS - 20) + "... [summarized]";
}

export const stableTurnSummarize: OptimizationTransform = {
  id: "stable_turn_summarize",

  applies(features: FeatureDetectionResult[], _request: CanonicalRequest, _profile?: LearningProfile): boolean {
    return features.some(f => f.featureId === "structural/stable_turns" && f.confidence > 0.4);
  },

  run(request: CanonicalRequest, _context: TransformContext): TransformResult {
    const keepRecent = request.policies?.keepRecentTurns ?? 4;
    const systemMsgs = request.messages.filter(m => m.role === "system");
    const nonSystemMsgs = request.messages.filter(m => m.role !== "system");

    if (nonSystemMsgs.length <= keepRecent) {
      return { request, applied: false, notes: [], riskLevel: "low" };
    }

    const stableSlice = nonSystemMsgs.slice(0, nonSystemMsgs.length - keepRecent);
    const recentSlice = nonSystemMsgs.slice(-keepRecent);
    const stableChars = stableSlice.reduce((a, m) => a + (m.text?.length ?? 0), 0);
    if (stableChars < MIN_STABLE_CHARS) {
      return { request, applied: false, notes: ["stable section too short to summarize"], riskLevel: "low" };
    }

    const summaries: CanonicalMessage[] = stableSlice
      .filter(m => m.text && m.text.length > 0)
      .map(m => ({
        role: m.role,
        text: summarizeText(m.text!),
        metadata: { ...m.metadata, summarized: true },
      }));

    const savedChars = stableChars - summaries.reduce((a, m) => a + (m.text?.length ?? 0), 0);

    return {
      request: { ...request, messages: [...systemMsgs, ...summaries, ...recentSlice] },
      applied: true,
      notes: [`summarized ${stableSlice.length} stable turns, saved ${savedChars} chars`],
      estimatedTokenDelta: -Math.ceil(savedChars / 4),
      riskLevel: "medium",
    };
  },
};
