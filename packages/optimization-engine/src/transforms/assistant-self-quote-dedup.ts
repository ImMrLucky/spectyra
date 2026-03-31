import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

function findLongestCommonSubstring(a: string, b: string, minLen: number): { start: number; len: number } | null {
  if (a.length < minLen || b.length < minLen) return null;
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  let bestStart = -1;
  let bestLen = 0;
  for (let i = 0; i < aLower.length; i++) {
    for (let j = 0; j < bLower.length; j++) {
      let len = 0;
      while (i + len < aLower.length && j + len < bLower.length && aLower[i + len] === bLower[j + len]) len++;
      if (len > bestLen && len >= minLen) { bestLen = len; bestStart = j; }
    }
  }
  return bestLen >= minLen ? { start: bestStart, len: bestLen } : null;
}

export const assistantSelfQuoteDedup: OptimizationTransform = {
  id: "assistant_self_quote_dedup",

  applies(features: FeatureDetectionResult[], request: CanonicalRequest): boolean {
    return request.messages.length >= 4 &&
      request.messages.some(m => m.role === "assistant" && (m.text?.length ?? 0) > 200);
  },

  run(request: CanonicalRequest, _ctx: TransformContext): TransformResult {
    const messages = [...request.messages];
    let totalSaved = 0;
    const MIN_QUOTE_LEN = 120;

    for (let i = 0; i < messages.length; i++) {
      if (messages[i].role !== "assistant") continue;
      const assistantText = messages[i].text ?? "";
      if (assistantText.length < 200) continue;

      for (let j = i - 1; j >= Math.max(0, i - 4); j--) {
        if (messages[j].role !== "user") continue;
        const userText = messages[j].text ?? "";
        if (userText.length < MIN_QUOTE_LEN) continue;

        const match = findLongestCommonSubstring(userText, assistantText, MIN_QUOTE_LEN);
        if (match) {
          const quoted = assistantText.slice(match.start, match.start + match.len);
          const replacement = `[ref: user message above, ${match.len} chars]`;
          messages[i] = { ...messages[i], text: assistantText.replace(quoted, replacement) };
          totalSaved += match.len - replacement.length;
        }
      }
    }

    if (totalSaved <= 0) {
      return { request, applied: false, notes: ["no assistant self-quotes found"], riskLevel: "low" };
    }

    return {
      request: { ...request, messages },
      applied: true,
      notes: [`removed ${totalSaved} chars of assistant self-quoting`],
      estimatedTokenDelta: -Math.ceil(totalSaved / 4),
      riskLevel: "low",
    };
  },
};
