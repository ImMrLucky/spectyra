/**
 * Context bloat detectors.
 *
 * Identifies oversized history, bloated system prompts, redundant schemas,
 * and unreferenced context bundles.
 */

import type {
  CanonicalRequest,
  FeatureDetector,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

function charLen(msg: { text?: string; parts?: Array<{ type: string; text?: string; content?: unknown }> }): number {
  if (msg.text) return msg.text.length;
  if (msg.parts) return msg.parts.reduce((n, p) => n + ((p.text ?? JSON.stringify(p.content ?? "")).length), 0);
  return 0;
}

const TOKEN_ESTIMATE_FACTOR = 4;

export const oversizedHistoryDetector: FeatureDetector = {
  id: "context_bloat/oversized_history",
  category: "context_bloat",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const nonSystemMsgs = input.messages.filter(m => m.role !== "system");
    const totalChars = nonSystemMsgs.reduce((a, m) => a + charLen(m), 0);
    const estimatedTokens = totalChars / TOKEN_ESTIMATE_FACTOR;
    if (estimatedTokens < 4000) return [];
    return [{
      featureId: "context_bloat/oversized_history",
      confidence: Math.min(1, estimatedTokens / 32_000),
      severity: estimatedTokens > 16_000 ? "high" : "medium",
      metrics: { estimatedHistoryTokens: Math.round(estimatedTokens), messageCount: nonSystemMsgs.length },
    }];
  },
};

export const oversizedSystemPromptDetector: FeatureDetector = {
  id: "context_bloat/oversized_system",
  category: "context_bloat",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const sysMsgs = input.messages.filter(m => m.role === "system");
    const totalChars = sysMsgs.reduce((a, m) => a + charLen(m), 0);
    const estimatedTokens = totalChars / TOKEN_ESTIMATE_FACTOR;
    if (estimatedTokens < 2000) return [];
    return [{
      featureId: "context_bloat/oversized_system",
      confidence: Math.min(1, estimatedTokens / 16_000),
      severity: estimatedTokens > 8_000 ? "high" : "medium",
      metrics: { estimatedSystemTokens: Math.round(estimatedTokens) },
    }];
  },
};

export const unreferencedBundlesDetector: FeatureDetector = {
  id: "context_bloat/unreferenced_bundles",
  category: "context_bloat",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (!input.context?.length) return [];
    const messageText = input.messages.map(m => m.text ?? "").join(" ");
    const unreferenced = input.context.filter(b => {
      if (!b.label) return false;
      return !messageText.includes(b.label);
    });
    if (unreferenced.length === 0) return [];
    return [{
      featureId: "context_bloat/unreferenced_bundles",
      confidence: unreferenced.length / input.context.length,
      severity: unreferenced.length > 3 ? "high" : "low",
      evidence: unreferenced.map(b => `unreferenced: ${b.label ?? b.id}`),
      metrics: { unreferencedCount: unreferenced.length, totalBundles: input.context.length },
    }];
  },
};

export const redundantSchemaDetector: FeatureDetector = {
  id: "context_bloat/redundant_schema",
  category: "context_bloat",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (!input.tools?.length) return [];
    const schemas = input.tools.map(t => JSON.stringify(t.inputSchema ?? {}));
    const seen = new Map<string, number>();
    for (const s of schemas) seen.set(s, (seen.get(s) ?? 0) + 1);
    const dupes = [...seen.entries()].filter(([, c]) => c > 1);
    if (dupes.length === 0) return [];
    return [{
      featureId: "context_bloat/redundant_schema",
      confidence: Math.min(1, dupes.length / input.tools.length),
      severity: "low",
      metrics: { duplicateSchemas: dupes.length },
    }];
  },
};

export const contextBloatDetectors: FeatureDetector[] = [
  oversizedHistoryDetector,
  oversizedSystemPromptDetector,
  unreferencedBundlesDetector,
  redundantSchemaDetector,
];
