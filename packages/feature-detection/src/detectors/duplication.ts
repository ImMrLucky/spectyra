/**
 * Duplication detectors.
 *
 * Finds repeated content in canonical requests — repeated messages,
 * repeated system instructions, repeated tool outputs, repeated file excerpts.
 */

import type {
  CanonicalRequest,
  FeatureDetector,
  FeatureDetectionResult,
  HistoricalSignals,
} from "@spectyra/canonical-model";

function textOf(msg: { text?: string; parts?: Array<{ type: string; text?: string; content?: string | unknown }> }): string {
  if (msg.text) return msg.text;
  if (msg.parts) return msg.parts.map(p => ("text" in p ? p.text : "") ?? "").join("");
  return "";
}

export const repeatedMessagesDetector: FeatureDetector = {
  id: "duplication/repeated_messages",
  category: "duplication",
  detect(input: CanonicalRequest, _history?: HistoricalSignals): FeatureDetectionResult[] {
    const seen = new Map<string, number>();
    for (const m of input.messages) {
      const key = `${m.role}::${textOf(m)}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const repeated = [...seen.entries()].filter(([, count]) => count > 1);
    if (repeated.length === 0) return [];
    const totalRepeated = repeated.reduce((acc, [, c]) => acc + (c - 1), 0);
    return [{
      featureId: "duplication/repeated_messages",
      confidence: Math.min(1, totalRepeated / input.messages.length),
      severity: totalRepeated > 3 ? "high" : "medium",
      evidence: repeated.map(([key, c]) => `${c}x: ${key.slice(0, 80)}`),
      metrics: { repeatedCount: totalRepeated, uniqueRepeated: repeated.length },
    }];
  },
};

export const repeatedSystemInstructionsDetector: FeatureDetector = {
  id: "duplication/repeated_system",
  category: "duplication",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const systemMsgs = input.messages.filter(m => m.role === "system");
    if (systemMsgs.length <= 1) return [];
    const texts = systemMsgs.map(m => textOf(m));
    const unique = new Set(texts);
    if (unique.size === systemMsgs.length) return [];
    return [{
      featureId: "duplication/repeated_system",
      confidence: 1 - (unique.size / systemMsgs.length),
      severity: "high",
      evidence: [`${systemMsgs.length} system messages, ${unique.size} unique`],
      metrics: { totalSystem: systemMsgs.length, uniqueSystem: unique.size },
    }];
  },
};

export const repeatedToolOutputsDetector: FeatureDetector = {
  id: "duplication/repeated_tool_outputs",
  category: "duplication",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const toolMsgs = input.messages.filter(m => m.role === "tool");
    if (toolMsgs.length <= 1) return [];
    const seen = new Map<string, number>();
    for (const m of toolMsgs) {
      const t = textOf(m);
      seen.set(t, (seen.get(t) ?? 0) + 1);
    }
    const repeated = [...seen.entries()].filter(([, c]) => c > 1);
    if (repeated.length === 0) return [];
    return [{
      featureId: "duplication/repeated_tool_outputs",
      confidence: Math.min(1, repeated.length / toolMsgs.length),
      severity: "medium",
      metrics: { repeatedToolOutputs: repeated.reduce((a, [, c]) => a + (c - 1), 0) },
    }];
  },
};

export const duplicationDetectors: FeatureDetector[] = [
  repeatedMessagesDetector,
  repeatedSystemInstructionsDetector,
  repeatedToolOutputsDetector,
];
