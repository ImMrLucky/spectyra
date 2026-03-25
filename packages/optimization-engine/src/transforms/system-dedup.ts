/**
 * System instruction deduplication transform.
 *
 * Merges duplicate system messages into a single message.
 * Triggered by duplication/repeated_system.
 */

import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

export const systemDedup: OptimizationTransform = {
  id: "system_dedup",

  applies(features: FeatureDetectionResult[]): boolean {
    return features.some(f => f.featureId === "duplication/repeated_system");
  },

  run(request: CanonicalRequest, _context: TransformContext): TransformResult {
    const systemMsgs = request.messages.filter(m => m.role === "system");
    const nonSystemMsgs = request.messages.filter(m => m.role !== "system");

    if (systemMsgs.length <= 1) {
      return { request, applied: false, notes: [], riskLevel: "low" };
    }

    const uniqueTexts = new Set<string>();
    const deduped: CanonicalMessage[] = [];
    let removedChars = 0;

    for (const msg of systemMsgs) {
      const text = msg.text ?? "";
      if (uniqueTexts.has(text)) {
        removedChars += text.length;
        continue;
      }
      uniqueTexts.add(text);
      deduped.push(msg);
    }

    return {
      request: { ...request, messages: [...deduped, ...nonSystemMsgs] },
      applied: removedChars > 0,
      notes: removedChars > 0 ? [`merged ${systemMsgs.length - deduped.length} duplicate system messages`] : [],
      estimatedTokenDelta: -Math.ceil(removedChars / 4),
      riskLevel: "low",
    };
  },
};
