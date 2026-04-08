/**
 * Merge pipeline-optimized canonical text back onto OpenAI-shaped messages while
 * preserving tool_calls, tool_call_id, and null assistant content where required.
 */

import type { CanonicalMessage } from "@spectyra/canonical-model";
import type { ChatMessage } from "./optimizer.js";

/**
 * When optimized messages are 1:1 with the original, apply optimized text per row.
 * Assistant rows with `tool_calls` keep those fields; only `content` is updated when non-empty.
 */
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
