/**
 * RefPack transform: replaces repeated stable content with compact [[R#]] references.
 * Runs after SCC since it operates on the post-SCC message set.
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
  unitizeMessages,
  buildGraph,
  spectralAnalyze,
  buildRefPack,
  applyInlineRefs,
  estimateTokens,
  profitGate,
  TALK_PROFIT_GATE,
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

export const refpackTransform: OptimizationTransform = {
  id: "refpack",

  applies(features: FeatureDetectionResult[], request: CanonicalRequest, _profile?: LearningProfile): boolean {
    const totalChars = request.messages.reduce((s, m) => s + (m.text?.length ?? 0), 0);
    return totalChars > 3000 && request.messages.length >= 4;
  },

  run(request: CanonicalRequest, _ctx: TransformContext): TransformResult {
    const chatMsgs = canonicalToChat(request);

    const units = unitizeMessages({
      path: "talk",
      messages: chatMsgs,
      lastTurnIndex: request.messages.length,
      opts: { maxUnits: 50, minChunkChars: 40, maxChunkChars: 900, includeSystem: false },
    });

    if (units.length < 4) {
      return { request, applied: false, notes: ["too few units for refpack"] };
    }

    const graph = buildGraph({ path: "talk", units, opts: SPECTRAL_OPTS });
    const spectral = spectralAnalyze({ graph, opts: SPECTRAL_OPTS, units });

    if (spectral.stableNodeIdx.length === 0) {
      return { request, applied: false, notes: ["no stable nodes for refpack"] };
    }

    const { refPack } = buildRefPack({ units, spectral, path: "talk" });
    if (refPack.entries.length === 0) {
      return { request, applied: false, notes: ["no refpack entries qualify"] };
    }

    const { messages: newMsgs, replacementsMade } = applyInlineRefs({
      messages: chatMsgs, refPack, spectral, units, omitDictionary: false,
    });

    if (replacementsMade === 0) {
      return { request, applied: false, notes: ["refpack: no replacements made"] };
    }

    const gate = profitGate(chatMsgs, newMsgs, TALK_PROFIT_GATE, "refpack");
    if (!gate.useAfter) {
      return { request, applied: false, notes: [`refpack reverted by profit gate (${gate.pct.toFixed(1)}%)`] };
    }

    return {
      request: { ...request, messages: chatToCanonicalMessages(newMsgs) },
      applied: true,
      notes: [`refpack: ${replacementsMade} replacements, ${refPack.entries.length} entries, ${gate.pct.toFixed(1)}% savings`],
      estimatedTokenDelta: gate.absChange,
      riskLevel: "low",
    };
  },
};
