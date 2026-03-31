/**
 * Whitespace normalization transform.
 *
 * Collapses excessive whitespace in message text. Always safe to apply.
 */

import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

function normalizeWhitespaceRaw(text: string): string {
  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Split text into alternating prose / code-fence segments, normalize only the
 * prose segments, and reassemble. Code fences (``` blocks) are preserved as-is.
 */
function normalizeWhitespace(text: string): string {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return parts
    .map((segment, i) => (i % 2 === 1 ? segment : normalizeWhitespaceRaw(segment)))
    .join("");
}

export const whitespaceNormalize: OptimizationTransform = {
  id: "whitespace_normalize",

  applies(_features: FeatureDetectionResult[], _request: CanonicalRequest): boolean {
    return true;
  },

  run(request: CanonicalRequest, _context: TransformContext): TransformResult {
    let totalDelta = 0;
    const messages: CanonicalMessage[] = request.messages.map(m => {
      if (!m.text) return m;
      const normalized = normalizeWhitespace(m.text);
      totalDelta += m.text.length - normalized.length;
      return { ...m, text: normalized };
    });

    return {
      request: { ...request, messages },
      applied: totalDelta > 0,
      notes: totalDelta > 0 ? [`removed ${totalDelta} chars of whitespace`] : [],
      estimatedTokenDelta: -Math.ceil(totalDelta / 4),
      riskLevel: "low",
    };
  },
};
