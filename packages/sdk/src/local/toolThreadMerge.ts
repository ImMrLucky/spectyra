/**
 * Merge pipeline-optimized canonical text back onto OpenAI-shaped messages while
 * preserving tool_calls, tool_call_id, and null assistant content — same behavior
 * as Local Companion.
 */

import type { CanonicalMessage } from "@spectyra/canonical-model";
import type { ChatMessage } from "../sharedTypes.js";

export function hasOpenAiToolThread(messages: ChatMessage[]): boolean {
  return messages.some(
    (m) =>
      m.role === "tool" ||
      m.tool_call_id != null ||
      (m.role === "assistant" && m.tool_calls != null),
  );
}

export function mergeOptimizedCanonicalIntoChatMessages(
  original: ChatMessage[],
  optimized: CanonicalMessage[],
): ChatMessage[] {
  if (original.length !== optimized.length) {
    return original.map((m) => ({ ...m }));
  }
  return original.map((orig, i) => {
    const opt = optimized[i];
    if (!opt) return { ...orig };
    const nextText = opt.text ?? "";

    if (orig.role === "assistant" && orig.tool_calls != null) {
      if (nextText === "") {
        return { ...orig };
      }
      return { ...orig, content: nextText };
    }

    if (orig.content === null && nextText === "") {
      return { ...orig };
    }

    return { ...orig, content: nextText };
  });
}
