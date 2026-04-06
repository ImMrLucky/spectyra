/**
 * Patch mode transform: injects system message instructing the model to
 * output minimal unified diffs for code-path requests.
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
  applyPatchMode,
  estimateInputTokens,
  type ChatMsg,
} from "@spectyra/optimizer-algorithms";

function canonicalToChat(req: CanonicalRequest): ChatMsg[] {
  return req.messages.map(m => ({ role: m.role, content: m.text ?? "" }));
}

function chatToCanonicalMessages(msgs: ChatMsg[]): CanonicalRequest["messages"] {
  return msgs.map(m => ({ role: m.role, text: m.content }));
}

function isCodePath(req: CanonicalRequest): boolean {
  if (req.policies?.desiredOutputShape === "code") return true;
  const lastUser = [...req.messages].reverse().find(m => m.role === "user");
  if (!lastUser?.text) return false;
  const t = lastUser.text.toLowerCase();
  return t.includes("code") || t.includes("function") || t.includes("implement") ||
    t.includes("fix") || t.includes("bug") || t.includes("error") ||
    t.includes("typescript") || t.includes("compile");
}

export const patchModeTransform: OptimizationTransform = {
  id: "patch_mode",

  applies(_features: FeatureDetectionResult[], request: CanonicalRequest, _profile?: LearningProfile): boolean {
    if (!isCodePath(request)) return false;
    return request.messages.length >= 4;
  },

  run(request: CanonicalRequest, ctx: TransformContext): TransformResult {
    const hasSCC = ctx.appliedTransformIds?.includes("spectral_scc");
    if (hasSCC) {
      return { request, applied: false, notes: ["patch mode skipped: SCC is authoritative"] };
    }

    const chatMsgs = canonicalToChat(request);
    const result = applyPatchMode({ messages: chatMsgs, enabled: true });

    const before = estimateInputTokens(chatMsgs);
    const after = estimateInputTokens(result.messages);

    return {
      request: { ...request, messages: chatToCanonicalMessages(result.messages) },
      applied: true,
      notes: ["patch mode: injected patch policy"],
      estimatedTokenDelta: before - after,
      riskLevel: "low",
    };
  },
};
