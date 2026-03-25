/**
 * Tool output truncation transform.
 *
 * Truncates excessively long tool outputs while preserving a head/tail
 * window. Triggered by agent_flow/tool_result_reinclusion or
 * context_bloat features.
 */

import type {
  CanonicalRequest,
  CanonicalMessage,
  OptimizationTransform,
  TransformContext,
  TransformResult,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

const MAX_TOOL_OUTPUT_CHARS = 3000;
const HEAD_CHARS = 1200;
const TAIL_CHARS = 800;

export const toolOutputTruncate: OptimizationTransform = {
  id: "tool_output_truncate",

  applies(features: FeatureDetectionResult[]): boolean {
    return features.some(f =>
      f.featureId === "agent_flow/tool_result_reinclusion" ||
      f.featureId.startsWith("context_bloat/") ||
      f.featureId === "duplication/repeated_tool_outputs",
    );
  },

  run(request: CanonicalRequest, _context: TransformContext): TransformResult {
    let truncatedCount = 0;
    let savedChars = 0;

    const messages: CanonicalMessage[] = request.messages.map(m => {
      if (m.role !== "tool" || !m.text || m.text.length <= MAX_TOOL_OUTPUT_CHARS) return m;
      const head = m.text.slice(0, HEAD_CHARS);
      const tail = m.text.slice(-TAIL_CHARS);
      const truncated = `${head}\n\n[...truncated ${m.text.length - HEAD_CHARS - TAIL_CHARS} chars...]\n\n${tail}`;
      savedChars += m.text.length - truncated.length;
      truncatedCount++;
      return { ...m, text: truncated };
    });

    return {
      request: { ...request, messages },
      applied: truncatedCount > 0,
      notes: truncatedCount > 0 ? [`truncated ${truncatedCount} tool outputs, saved ${savedChars} chars`] : [],
      estimatedTokenDelta: -Math.ceil(savedChars / 4),
      riskLevel: "medium",
    };
  },
};
