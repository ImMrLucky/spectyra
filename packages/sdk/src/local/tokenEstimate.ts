import type { ChatMessage } from "../sharedTypes.js";

/** Token estimate aligned with Local Companion (role + content + tool fields). */
export function estimateTokensFromMessages(messages: ChatMessage[]): number {
  let chars = 0;
  for (const m of messages) {
    chars += m.role.length + 4 + (m.content?.length ?? 0);
    if (m.tool_calls != null) chars += JSON.stringify(m.tool_calls).length;
    if (m.tool_call_id) chars += m.tool_call_id.length;
    if (m.name) chars += m.name.length;
  }
  return Math.ceil(chars / 4);
}
