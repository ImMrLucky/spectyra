/**
 * Delta prompting transform: injects delta policy system message for
 * concise, change-focused responses.
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
  applyDeltaPrompting,
  estimateInputTokens,
  type ChatMsg,
  type PathKind,
} from "@spectyra/optimizer-algorithms";

function canonicalToChat(req: CanonicalRequest): ChatMsg[] {
  return req.messages.map(m => ({ role: m.role, content: m.text ?? "" }));
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

export const deltaPromptingTransform: OptimizationTransform = {
  id: "delta_prompting",

  applies(_features: FeatureDetectionResult[], request: CanonicalRequest, _profile?: LearningProfile): boolean {
    return request.messages.length >= 6;
  },

  run(request: CanonicalRequest, ctx: TransformContext): TransformResult {
    const hasSCC = ctx.appliedTransformIds?.includes("spectral_scc");
    if (hasSCC) {
      return { request, applied: false, notes: ["delta prompting skipped: SCC is authoritative"] };
    }

    const chatMsgs = canonicalToChat(request);
    const path = detectPath(request);

    const result = applyDeltaPrompting({ path, messages: chatMsgs, enabled: true });

    if (!result.deltaUsed) {
      return { request, applied: false, notes: ["delta prompting: not used"] };
    }

    const before = estimateInputTokens(chatMsgs);
    const after = estimateInputTokens(result.messages);

    return {
      request: { ...request, messages: chatToCanonicalMessages(result.messages) },
      applied: true,
      notes: [`delta prompting (${path}): injected delta policy`],
      estimatedTokenDelta: before - after,
      riskLevel: "low",
    };
  },
};
