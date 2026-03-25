/**
 * PG-SCC (Spectral Context Compiler) transform.
 *
 * Bridges canonical request messages to the full Spectyra optimization pipeline:
 * unitize → buildGraph → spectralAnalyze → computeBudgets → compileTalkState/compileCodeState.
 *
 * This replaces older history with a compact state message + recent turns.
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
  computeBudgetsFromSpectral,
  compileTalkState,
  compileCodeState,
  estimateTokens,
  type ChatMsg,
  type PathKind,
  type SpectralOptions,
} from "@spectyra/optimizer-algorithms";

function canonicalToChat(req: CanonicalRequest): ChatMsg[] {
  return req.messages.map(m => ({
    role: m.role,
    content: m.text ?? "",
  }));
}

function chatToCanonicalMessages(msgs: ChatMsg[]): CanonicalRequest["messages"] {
  return msgs.map(m => ({ role: m.role, text: m.content }));
}

function detectPath(req: CanonicalRequest): PathKind {
  if (req.policies?.desiredOutputShape === "code") return "code";
  const lastUser = [...req.messages].reverse().find(m => m.role === "user");
  if (!lastUser?.text) return "talk";
  const t = lastUser.text.toLowerCase();
  if (
    t.includes("code") || t.includes("function") || t.includes("implement") ||
    t.includes("fix") || t.includes("bug") || t.includes("error") ||
    t.includes("typescript") || t.includes("compile")
  ) return "code";
  return "talk";
}

const DEFAULT_SPECTRAL_OPTS: SpectralOptions = {
  tLow: 0.3,
  tHigh: 0.65,
  maxNodes: 50,
  similarityEdgeMin: 0.85,
  contradictionEdgeWeight: -0.8,
};

const DEFAULT_UNITIZE_OPTS = {
  maxUnits: 50,
  minChunkChars: 40,
  maxChunkChars: 900,
  includeSystem: false,
};

export const spectralSCC: OptimizationTransform = {
  id: "spectral_scc",

  applies(features: FeatureDetectionResult[], request: CanonicalRequest, _profile?: LearningProfile): boolean {
    if (request.messages.length < 6) return false;
    const totalChars = request.messages.reduce((s, m) => s + (m.text?.length ?? 0), 0);
    return totalChars > 2000;
  },

  run(request: CanonicalRequest, _ctx: TransformContext): TransformResult {
    const chatMsgs = canonicalToChat(request);
    const path = detectPath(request);

    const units = unitizeMessages({
      path,
      messages: chatMsgs,
      lastTurnIndex: request.messages.length,
      opts: DEFAULT_UNITIZE_OPTS,
    });

    if (units.length < 3) {
      return { request, applied: false, notes: ["too few units for SCC"] };
    }

    const graph = buildGraph({ path, units, opts: DEFAULT_SPECTRAL_OPTS });
    const spectral = spectralAnalyze({ graph, opts: DEFAULT_SPECTRAL_OPTS, units, currentTurn: request.messages.length });
    const budgets = computeBudgetsFromSpectral({ spectral, messages: chatMsgs });

    let keptMessages: ChatMsg[];
    let droppedCount: number;

    if (path === "code") {
      const result = compileCodeState({ messages: chatMsgs, units, spectral, budgets });
      keptMessages = result.keptMessages;
      droppedCount = result.droppedCount;
    } else {
      const result = compileTalkState({ messages: chatMsgs, units, spectral, budgets });
      keptMessages = result.keptMessages;
      droppedCount = result.droppedCount;
    }

    if (droppedCount <= 0) {
      return { request, applied: false, notes: ["SCC found nothing to compress"] };
    }

    const beforeTokens = chatMsgs.reduce((s, m) => s + estimateTokens(m.content), 0);
    const afterTokens = keptMessages.reduce((s, m) => s + estimateTokens(m.content), 0);
    if (afterTokens >= beforeTokens) {
      return { request, applied: false, notes: ["SCC would increase tokens — reverted"] };
    }

    const optimized: CanonicalRequest = {
      ...request,
      messages: chatToCanonicalMessages(keptMessages),
    };

    return {
      request: optimized,
      applied: true,
      notes: [
        `SCC (${path}): dropped ${droppedCount} messages`,
        `stability=${spectral.stabilityIndex.toFixed(3)}, λ₂=${spectral.lambda2.toFixed(3)}, recommendation=${spectral.recommendation}`,
      ],
      estimatedTokenDelta: beforeTokens - afterTokens,
      riskLevel: spectral.recommendation === "ASK_CLARIFY" ? "medium" : "low",
    };
  },
};
