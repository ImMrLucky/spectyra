/**
 * PhraseBook / STE transform: encodes repeated phrases as short symbols.
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
  buildLocalPhraseBook,
  buildSTE,
  profitGate,
  TALK_PROFIT_GATE,
  type ChatMsg,
} from "@spectyra/optimizer-algorithms";

function canonicalToChat(req: CanonicalRequest): ChatMsg[] {
  return req.messages.map(m => ({ role: m.role, content: m.text ?? "" }));
}

function chatToCanonicalMessages(msgs: ChatMsg[]): CanonicalRequest["messages"] {
  return msgs.map(m => ({ role: m.role, text: m.content }));
}

export const phrasebookTransform: OptimizationTransform = {
  id: "phrasebook",

  applies(features: FeatureDetectionResult[], request: CanonicalRequest, _profile?: LearningProfile): boolean {
    const totalChars = request.messages.reduce((s, m) => s + (m.text?.length ?? 0), 0);
    return totalChars > 2000 && request.messages.length >= 4;
  },

  run(request: CanonicalRequest, ctx: TransformContext): TransformResult {
    const chatMsgs = canonicalToChat(request);
    const useSTE = ctx.appliedTransformIds?.includes("spectral_scc");
    const aggressiveness = 0.6;

    if (useSTE) {
      const steResult = buildSTE({ messages: chatMsgs, aggressiveness });
      if (!steResult.changed) {
        return { request, applied: false, notes: ["STE: no phrases found"] };
      }
      const gate = profitGate(chatMsgs, steResult.messages, TALK_PROFIT_GATE, "ste");
      if (!gate.useAfter) {
        return { request, applied: false, notes: [`STE reverted by profit gate (${gate.pct.toFixed(1)}%)`] };
      }
      return {
        request: { ...request, messages: chatToCanonicalMessages(steResult.messages) },
        applied: true,
        notes: [`STE: ${steResult.ste.entries.length} entries, ${gate.pct.toFixed(1)}% savings`],
        estimatedTokenDelta: gate.absChange,
        riskLevel: "low",
      };
    }

    const pbResult = buildLocalPhraseBook({ messages: chatMsgs, aggressiveness });
    if (!pbResult.changed) {
      return { request, applied: false, notes: ["phrasebook: no phrases found"] };
    }

    const gate = profitGate(chatMsgs, pbResult.messages, TALK_PROFIT_GATE, "phrasebook");
    if (!gate.useAfter) {
      return { request, applied: false, notes: [`phrasebook reverted by profit gate (${gate.pct.toFixed(1)}%)`] };
    }

    return {
      request: { ...request, messages: chatToCanonicalMessages(pbResult.messages) },
      applied: true,
      notes: [`phrasebook: ${pbResult.phraseBook.entries.length} entries, ${gate.pct.toFixed(1)}% savings`],
      estimatedTokenDelta: gate.absChange,
      riskLevel: "low",
    };
  },
};
