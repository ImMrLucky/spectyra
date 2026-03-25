/**
 * Consecutive message deduplication transform.
 *
 * Removes exact-duplicate consecutive messages of the same role.
 * Triggered by the duplication/repeated_messages feature.
 */

import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

export const dedupConsecutive: OptimizationTransform = {
  id: "dedup_consecutive",

  applies(features: FeatureDetectionResult[]): boolean {
    return features.some(f => f.featureId.startsWith("duplication/"));
  },

  run(request: CanonicalRequest, _context: TransformContext): TransformResult {
    const deduped: CanonicalMessage[] = [];
    let removed = 0;
    let removedChars = 0;

    for (const msg of request.messages) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.role === msg.role && prev.text === msg.text && msg.text) {
        removed++;
        removedChars += msg.text.length;
        continue;
      }
      deduped.push(msg);
    }

    return {
      request: { ...request, messages: deduped },
      applied: removed > 0,
      notes: removed > 0 ? [`removed ${removed} consecutive duplicate messages`] : [],
      estimatedTokenDelta: -Math.ceil(removedChars / 4),
      riskLevel: "low",
    };
  },
};
