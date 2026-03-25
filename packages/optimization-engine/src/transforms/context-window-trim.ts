/**
 * Context window trim transform.
 *
 * When conversation history is oversized, trims older messages while
 * preserving the system prompt and a configurable number of recent turns.
 * Triggered by context_bloat/oversized_history.
 */

import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

const DEFAULT_KEEP_RECENT = 6;

export const contextWindowTrim: OptimizationTransform = {
  id: "context_window_trim",

  applies(features: FeatureDetectionResult[], request: CanonicalRequest): boolean {
    if (features.some(f => f.featureId === "safety_constraints/recent_turns_preserved")) {
      return false;
    }
    return features.some(f => f.featureId === "context_bloat/oversized_history");
  },

  run(request: CanonicalRequest, _context: TransformContext): TransformResult {
    const keepRecent = request.policies?.keepRecentTurns ?? DEFAULT_KEEP_RECENT;
    const systemMsgs = request.messages.filter(m => m.role === "system");
    const nonSystemMsgs = request.messages.filter(m => m.role !== "system");

    if (nonSystemMsgs.length <= keepRecent) {
      return { request, applied: false, notes: [], riskLevel: "low" };
    }

    const dropped = nonSystemMsgs.slice(0, nonSystemMsgs.length - keepRecent);
    const kept = nonSystemMsgs.slice(-keepRecent);
    const droppedChars = dropped.reduce((a, m) => a + (m.text?.length ?? 0), 0);

    const summary: CanonicalMessage = {
      role: "system",
      text: `[${dropped.length} earlier messages trimmed to fit context window]`,
    };

    const messages: CanonicalMessage[] = [...systemMsgs, summary, ...kept];

    return {
      request: { ...request, messages },
      applied: true,
      notes: [`trimmed ${dropped.length} older messages (${droppedChars} chars)`],
      estimatedTokenDelta: -Math.ceil(droppedChars / 4),
      riskLevel: "medium",
    };
  },
};
