/**
 * Local optimization engine.
 *
 * Applies lightweight optimization transforms in-process.
 * No Spectyra cloud dependency.
 */

import type { SpectyraRunMode } from "@spectyra/core-types";

export interface ChatMessage {
  role: string;
  content: string;
}

export interface OptimizeResult {
  messages: ChatMessage[];
  inputTokensBefore: number;
  inputTokensAfter: number;
  transforms: string[];
}

function estimateTokens(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) chars += m.role.length + m.content.length + 4;
  return Math.ceil(chars / 4);
}

function applyOptimizations(messages: ChatMessage[]): { messages: ChatMessage[]; transforms: string[] } {
  const transforms: string[] = [];
  let optimized = messages.map((m) => ({
    ...m,
    content: m.content.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim(),
  }));
  transforms.push("whitespace_normalize");

  const deduped: ChatMessage[] = [];
  for (const msg of optimized) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === msg.role && prev.content === msg.content) continue;
    deduped.push(msg);
  }
  if (deduped.length < optimized.length) transforms.push("dedup_consecutive");
  optimized = deduped;

  optimized = optimized.map((m) => {
    if (m.role === "tool" && m.content.length > 2000) {
      transforms.push("tool_output_truncate");
      return {
        ...m,
        content: `${m.content.slice(0, 500)}\n...[truncated]...\n${m.content.slice(-500)}`,
      };
    }
    return m;
  });

  if (optimized.length > 20) {
    const sys = optimized.filter((m) => m.role === "system");
    const rest = optimized.filter((m) => m.role !== "system");
    optimized = [...sys, ...rest.slice(-16)];
    transforms.push("context_window_trim");
  }

  return { messages: optimized, transforms };
}

export function optimize(messages: ChatMessage[], runMode: SpectyraRunMode): OptimizeResult {
  const inputTokensBefore = estimateTokens(messages);

  if (runMode === "off") {
    return { messages: [...messages], inputTokensBefore, inputTokensAfter: inputTokensBefore, transforms: [] };
  }

  const { messages: optimized, transforms } = applyOptimizations(messages);
  const inputTokensAfter = estimateTokens(optimized);

  if (runMode === "observe") {
    return { messages: [...messages], inputTokensBefore, inputTokensAfter, transforms };
  }

  // on
  return { messages: optimized, inputTokensBefore, inputTokensAfter, transforms };
}
