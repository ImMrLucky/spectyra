/**
 * CodeMap transform: replaces verbose code blocks with structural maps and
 * snippet references for code-path requests.
 */

import type {
  CanonicalRequest,
  FeatureDetectionResult,
  LearningProfile,
  OptimizationTransform,
  TransformContext,
  TransformResult,
} from "@spectyra/canonical-model";
import {
  buildCodeMap,
  unitizeMessages,
  buildGraph,
  spectralAnalyze,
  computeBudgetsFromSpectral,
  profitGate,
  CODE_PROFIT_GATE,
  type ChatMsg,
  type SpectralOptions,
} from "@spectyra/optimizer-algorithms";

function canonicalToChat(req: CanonicalRequest): ChatMsg[] {
  return req.messages.map(m => ({ role: m.role, content: m.text ?? "" }));
}

function chatToCanonicalMessages(msgs: ChatMsg[]): CanonicalRequest["messages"] {
  return msgs.map(m => ({ role: m.role, text: m.content }));
}

const SPECTRAL_OPTS: SpectralOptions = {
  tLow: 0.3, tHigh: 0.65, maxNodes: 50, similarityEdgeMin: 0.85, contradictionEdgeWeight: -0.8,
};

function hasCodeBlocks(request: CanonicalRequest): boolean {
  return request.messages.some(m => m.text?.includes("```"));
}

export const codemapTransform: OptimizationTransform = {
  id: "codemap",

  applies(features: FeatureDetectionResult[], request: CanonicalRequest, _profile?: LearningProfile): boolean {
    if (!hasCodeBlocks(request)) return false;
    const totalChars = request.messages.reduce((s, m) => s + (m.text?.length ?? 0), 0);
    return totalChars > 4000;
  },

  run(request: CanonicalRequest, _ctx: TransformContext): TransformResult {
    const chatMsgs = canonicalToChat(request);

    const units = unitizeMessages({
      path: "code",
      messages: chatMsgs,
      lastTurnIndex: request.messages.length,
      opts: { maxUnits: 50, minChunkChars: 40, maxChunkChars: 900, includeSystem: false },
    });

    const graph = buildGraph({ path: "code", units, opts: SPECTRAL_OPTS });
    const spectral = spectralAnalyze({ graph, opts: SPECTRAL_OPTS, units });
    const budgets = computeBudgetsFromSpectral({ spectral });

    const detailLevel = budgets.codemapDetailLevel;
    const structuralOnly = detailLevel < 0.5;

    const result = buildCodeMap({ messages: chatMsgs, spectral, detailLevel, structuralOnly });
    if (!result.changed || !result.codeMap) {
      return { request, applied: false, notes: ["codemap: no code blocks to process"] };
    }

    const gate = profitGate(chatMsgs, result.messages, CODE_PROFIT_GATE, "codemap");
    if (!gate.useAfter) {
      return { request, applied: false, notes: [`codemap reverted by profit gate (${gate.pct.toFixed(1)}%)`] };
    }

    return {
      request: { ...request, messages: chatToCanonicalMessages(result.messages) },
      applied: true,
      notes: [
        `codemap: ${result.codeMap.symbols.length} symbols, ${result.codeMap.snippets.length} snippets kept`,
        `${gate.pct.toFixed(1)}% savings, detailLevel=${detailLevel.toFixed(2)}`,
      ],
      estimatedTokenDelta: gate.absChange,
      riskLevel: structuralOnly ? "medium" : "low",
    };
  },
};
