/**
 * Code slicer transform: reduces code-path message context by keeping only
 * the most relevant fenced code block and trimming large blocks.
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
  applyCodeSlicing,
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

export const codeSlicerTransform: OptimizationTransform = {
  id: "code_slicer",

  applies(_features: FeatureDetectionResult[], request: CanonicalRequest, _profile?: LearningProfile): boolean {
    if (!isCodePath(request)) return false;
    return request.messages.some(m => m.text?.includes("```")) && request.messages.length >= 4;
  },

  run(request: CanonicalRequest, ctx: TransformContext): TransformResult {
    const hasSCC = ctx.appliedTransformIds?.includes("spectral_scc");
    if (hasSCC) {
      return { request, applied: false, notes: ["code slicer skipped: SCC already applied"] };
    }

    const chatMsgs = canonicalToChat(request);
    const result = applyCodeSlicing({ messages: chatMsgs, aggressive: true });

    if (!result.changed) {
      return { request, applied: false, notes: ["code slicer: no code blocks to slice"] };
    }

    const before = estimateInputTokens(chatMsgs);
    const after = estimateInputTokens(result.messages);

    if (after >= before) {
      return { request, applied: false, notes: ["code slicer: would increase tokens"] };
    }

    return {
      request: { ...request, messages: chatToCanonicalMessages(result.messages) },
      applied: true,
      notes: [
        `code slicer: ${result.metadata?.blocksFound ?? 0} blocks → ${result.metadata?.blocksKept ?? 1}`,
        `${result.metadata?.linesRemoved ?? 0} lines removed`,
      ],
      estimatedTokenDelta: before - after,
      riskLevel: "medium",
    };
  },
};
