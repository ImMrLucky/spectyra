/**
 * Structural opportunity detectors.
 *
 * Identifies patterns where specific transforms (codemap, phrasebook,
 * refpack, summarization, delta output) are likely to be effective.
 */

import type {
  CanonicalRequest,
  FeatureDetector,
  FeatureDetectionResult,
} from "@spectyra/canonical-model";

const CODE_BLOCK_RE = /```[\s\S]*?```/g;
const LARGE_CODE_THRESHOLD = 500;

export const largeCodeBlocksDetector: FeatureDetector = {
  id: "structural/large_code_blocks",
  category: "structural",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    let largeBlocks = 0;
    let totalCodeChars = 0;
    for (const m of input.messages) {
      if (!m.text) continue;
      const matches = m.text.matchAll(CODE_BLOCK_RE);
      for (const match of matches) {
        if (match[0].length > LARGE_CODE_THRESHOLD) {
          largeBlocks++;
          totalCodeChars += match[0].length;
        }
      }
      if (m.parts) {
        for (const p of m.parts) {
          if (p.type === "code" && p.content.length > LARGE_CODE_THRESHOLD) {
            largeBlocks++;
            totalCodeChars += p.content.length;
          }
        }
      }
    }
    if (largeBlocks === 0) return [];
    return [{
      featureId: "structural/large_code_blocks",
      confidence: Math.min(1, largeBlocks * 0.25),
      severity: largeBlocks > 3 ? "high" : "medium",
      evidence: [`${largeBlocks} code blocks > ${LARGE_CODE_THRESHOLD} chars`],
      metrics: { largeCodeBlocks: largeBlocks, totalCodeChars },
    }];
  },
};

export const repeatedPhrasesDetector: FeatureDetector = {
  id: "structural/repeated_phrases",
  category: "structural",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    const allText = input.messages.map(m => m.text ?? "").join("\n");
    if (allText.length < 200) return [];

    const phrases = new Map<string, number>();
    const words = allText.split(/\s+/);
    const windowSize = 8;
    for (let i = 0; i <= words.length - windowSize; i++) {
      const phrase = words.slice(i, i + windowSize).join(" ");
      phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
    }
    const repeated = [...phrases.entries()].filter(([, c]) => c > 2);
    if (repeated.length === 0) return [];
    return [{
      featureId: "structural/repeated_phrases",
      confidence: Math.min(1, repeated.length * 0.1),
      severity: repeated.length > 10 ? "high" : "medium",
      metrics: { repeatedPhraseGroups: repeated.length },
    }];
  },
};

export const stableTurnsDetector: FeatureDetector = {
  id: "structural/stable_turns",
  category: "structural",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (input.messages.length < 6) return [];
    const recentThreshold = Math.max(2, input.policies?.keepRecentTurns ?? 4);
    const stableTurns = input.messages.length - recentThreshold;
    if (stableTurns < 3) return [];
    const stableChars = input.messages.slice(0, stableTurns).reduce((a, m) => a + (m.text?.length ?? 0), 0);
    const totalChars = input.messages.reduce((a, m) => a + (m.text?.length ?? 0), 0);
    const ratio = totalChars > 0 ? stableChars / totalChars : 0;
    if (ratio < 0.3) return [];
    return [{
      featureId: "structural/stable_turns",
      confidence: ratio,
      severity: ratio > 0.6 ? "high" : "medium",
      metrics: { stableTurnCount: stableTurns, stableCharRatio: Math.round(ratio * 100) / 100 },
    }];
  },
};

export const repeatedReferencesDetector: FeatureDetector = {
  id: "structural/repeated_references",
  category: "structural",
  detect(input: CanonicalRequest): FeatureDetectionResult[] {
    if (!input.context?.length) return [];
    const idCounts = new Map<string, number>();
    for (const b of input.context) {
      if (b.metadata?.repeated) {
        idCounts.set(b.id, (idCounts.get(b.id) ?? 0) + 1);
      }
    }
    const repeated = [...idCounts.entries()].filter(([, c]) => c > 1);
    if (repeated.length === 0) return [];
    return [{
      featureId: "structural/repeated_references",
      confidence: Math.min(1, repeated.length / input.context.length),
      severity: "medium",
      metrics: { repeatedRefCount: repeated.length },
    }];
  },
};

export const structuralDetectors: FeatureDetector[] = [
  largeCodeBlocksDetector,
  repeatedPhrasesDetector,
  stableTurnsDetector,
  repeatedReferencesDetector,
];
