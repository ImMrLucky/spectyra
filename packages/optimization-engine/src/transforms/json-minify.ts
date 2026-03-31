import type {
  CanonicalRequest,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

const JSON_BLOCK_RE = /```(?:json)?\s*\n([\s\S]*?)\n\s*```/g;

function tryMinifyJson(text: string): { minified: string; saved: number } | null {
  try {
    const parsed = JSON.parse(text);
    const compact = JSON.stringify(parsed);
    const saved = text.length - compact.length;
    return saved > 50 ? { minified: compact, saved } : null;
  } catch {
    return null;
  }
}

function minifyJsonInMessage(text: string): { result: string; totalSaved: number } {
  let totalSaved = 0;
  const result = text.replace(JSON_BLOCK_RE, (full, jsonContent: string) => {
    const m = tryMinifyJson(jsonContent.trim());
    if (m) {
      totalSaved += m.saved;
      return "```json\n" + m.minified + "\n```";
    }
    return full;
  });

  const bareJsonRe = /(?:^|\n)(\{[\s\S]{500,}?\}|\[[\s\S]{500,}?\])(?:\n|$)/g;
  const result2 = result.replace(bareJsonRe, (full, candidate: string) => {
    const m = tryMinifyJson(candidate.trim());
    if (m) {
      totalSaved += m.saved;
      return "\n" + m.minified + "\n";
    }
    return full;
  });

  return { result: result2, totalSaved };
}

export const jsonMinify: OptimizationTransform = {
  id: "json_minify",

  applies(features: FeatureDetectionResult[], request: CanonicalRequest): boolean {
    const totalChars = request.messages.reduce((s, m) => s + (m.text?.length ?? 0), 0);
    if (totalChars < 2000) return false;
    return request.messages.some(m =>
      (m.role === "tool" || m.role === "assistant") && (m.text?.includes("{") || m.text?.includes("["))
    );
  },

  run(request: CanonicalRequest, _ctx: TransformContext): TransformResult {
    let totalSaved = 0;
    const messages = request.messages.map(m => {
      if (!m.text || m.text.length < 200) return m;
      if (m.role === "system") return m;
      const { result, totalSaved: saved } = minifyJsonInMessage(m.text);
      totalSaved += saved;
      return saved > 0 ? { ...m, text: result } : m;
    });

    if (totalSaved <= 50) {
      return { request, applied: false, notes: ["json minify: no significant savings"], riskLevel: "low" };
    }

    return {
      request: { ...request, messages },
      applied: true,
      notes: [`json minify: ${totalSaved} chars saved from JSON compaction`],
      estimatedTokenDelta: -Math.ceil(totalSaved / 4),
      riskLevel: "low",
    };
  },
};
