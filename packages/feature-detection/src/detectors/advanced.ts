/**
 * Advanced feature detectors.
 *
 * Tool-call loops, near-duplicate assistant messages (SimHash-based),
 * base64/binary blob detection, thinking-block bloat, and long tool outputs.
 */

import type {
  CanonicalRequest,
  FeatureDetector,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

function msgText(msg: { text?: string }): string {
  return msg.text ?? "";
}

// ── SimHash helpers ──────────────────────────────────────────────────────────

function shingles(text: string, n: number): Set<string> {
  const words = text.toLowerCase().split(/\s+/);
  const out = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    out.add(words.slice(i, i + n).join(" "));
  }
  return out;
}

function shingleOverlap(a: Set<string>, b: Set<string>): number {
  const union = new Set([...a, ...b]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const s of a) {
    if (b.has(s)) intersection++;
  }
  return intersection / union.size;
}

// ── Detectors ────────────────────────────────────────────────────────────────

export const toolCallLoopDetector: FeatureDetector = {
  id: "agent_flow/tool_call_loop",
  category: "agent_flow",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const toolMsgs = input.messages.filter(m => m.role === "tool");
    if (toolMsgs.length < 3) return [];

    const groups = new Map<string, number>();
    for (const m of toolMsgs) {
      const key = msgText(m).slice(0, 200);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }

    const loops = [...groups.entries()].filter(([, c]) => c >= 3);
    if (loops.length === 0) return [];

    const loopCount = loops.reduce((a, [, c]) => a + c, 0);
    return [{
      featureId: "agent_flow/tool_call_loop",
      confidence: Math.min(1, loopCount * 0.3),
      severity: loopCount > 3 ? "high" : "medium",
      evidence: loops.map(([key, c]) => `${c}x: ${key.slice(0, 80)}`),
      metrics: { loopCount, distinctLoops: loops.length },
    }];
  },
};

export const nearDuplicateAssistantDetector: FeatureDetector = {
  id: "duplication/near_duplicate_assistant",
  category: "duplication",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const assistantTexts = input.messages
      .filter(m => m.role === "assistant")
      .map(m => msgText(m))
      .filter(t => t.length > 50);

    if (assistantTexts.length < 2) return [];

    const shingleSets = assistantTexts.map(t => shingles(t, 4));
    let nearDupPairs = 0;

    for (let i = 0; i < shingleSets.length; i++) {
      for (let j = i + 1; j < shingleSets.length; j++) {
        if (shingleOverlap(shingleSets[i], shingleSets[j]) > 0.6) {
          nearDupPairs++;
        }
      }
    }

    if (nearDupPairs === 0) return [];
    return [{
      featureId: "duplication/near_duplicate_assistant",
      confidence: Math.min(1, nearDupPairs * 0.25),
      severity: nearDupPairs > 2 ? "high" : "medium",
      metrics: { nearDuplicatePairs: nearDupPairs, assistantMessages: assistantTexts.length },
    }];
  },
};

const BASE64_PATTERN = /(?:data:[^\s;]+;base64,|[A-Za-z0-9+/]{500,}={0,2})/g;

export const base64BlobDetector: FeatureDetector = {
  id: "context_bloat/base64_blob",
  category: "context_bloat",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    let totalBlobChars = 0;
    const evidence: string[] = [];

    for (const m of input.messages) {
      const text = msgText(m);
      const matches = text.match(BASE64_PATTERN);
      if (matches) {
        for (const match of matches) {
          totalBlobChars += match.length;
        }
        evidence.push(`${m.role} message: ${matches.length} blob(s)`);
      }
    }

    if (totalBlobChars === 0) return [];
    return [{
      featureId: "context_bloat/base64_blob",
      confidence: Math.min(1, totalBlobChars / 50_000),
      severity: totalBlobChars > 20_000 ? "high" : "medium",
      evidence,
      metrics: { totalBlobChars },
    }];
  },
};

const THINKING_PATTERN = /<thinking>[\s\S]*?<\/thinking>/gi;

export const thinkingBlockDetector: FeatureDetector = {
  id: "structural/thinking_blocks",
  category: "structural",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    let thinkingChars = 0;
    let totalChars = 0;

    for (const m of input.messages) {
      const text = msgText(m);
      totalChars += text.length;
      const matches = text.match(THINKING_PATTERN);
      if (matches) {
        for (const match of matches) {
          thinkingChars += match.length;
        }
      }
    }

    if (totalChars === 0 || thinkingChars === 0) return [];
    const ratio = thinkingChars / totalChars;
    return [{
      featureId: "structural/thinking_blocks",
      confidence: Math.min(1, ratio),
      severity: ratio > 0.3 ? "high" : "medium",
      metrics: { thinkingChars, totalChars, ratio: Math.round(ratio * 100) / 100 },
    }];
  },
};

export const longToolOutputDetector: FeatureDetector = {
  id: "context_bloat/long_tool_output",
  category: "context_bloat",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const toolMsgs = input.messages.filter(m => m.role === "tool");
    let longOutputs = 0;
    let maxLen = 0;

    for (const m of toolMsgs) {
      const len = msgText(m).length;
      if (len > maxLen) maxLen = len;
      if (len > 10_000) longOutputs++;
    }

    if (longOutputs === 0) return [];
    return [{
      featureId: "context_bloat/long_tool_output",
      confidence: Math.min(1, longOutputs * 0.3),
      severity: maxLen > 50_000 ? "high" : "medium",
      metrics: { longOutputs, maxOutputLength: maxLen },
    }];
  },
};

export const advancedDetectors: FeatureDetector[] = [
  toolCallLoopDetector,
  nearDuplicateAssistantDetector,
  base64BlobDetector,
  thinkingBlockDetector,
  longToolOutputDetector,
];
