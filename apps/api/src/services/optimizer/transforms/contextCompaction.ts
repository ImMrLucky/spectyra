import { PathKind, SemanticUnit } from "../spectral/types";
import { ChatMessage } from "../unitize";

export interface ContextCompactionInput {
  path: PathKind;
  messages: ChatMessage[];
  units: SemanticUnit[];

  stableUnitIds: string[];
  aggressive: boolean;
}

export interface ContextCompactionOutput {
  messages: ChatMessage[];
  refsUsed: string[];
}

function summarizeUnit(text: string, maxLen = 180): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1).trim() + "…";
}

function findStableUnits(units: SemanticUnit[], stableUnitIds: string[]): SemanticUnit[] {
  const set = new Set(stableUnitIds);
  return units.filter(u => set.has(u.id));
}

/**
 * Compaction policy:
 * - Build REF glossary from stable units (summaries).
 * - Insert a system message with the glossary (short).
 * - Optionally remove older assistant text that matches stable content (aggressive only).
 *
 * MVP: We do not attempt perfect substring replacement across messages, because that's brittle.
 * Instead we:
 *  - Keep user messages intact
 *  - Add REFs as a "memory" system note
 *  - Aggressive mode: drop older assistant messages to reduce context size
 */
export function applyContextCompaction(input: ContextCompactionInput): ContextCompactionOutput {
  const { path, messages, units, stableUnitIds, aggressive } = input;

  const stableUnits = findStableUnits(units, stableUnitIds).slice(-12); // hard cap
  if (stableUnits.length === 0) return { messages, refsUsed: [] };

  const refs = stableUnits.map(u => ({
    id: u.id,
    summary: summarizeUnit(u.text, path === "code" ? 140 : 180)
  }));

  const glossaryLines = refs.map(r => `- [[REF:${r.id}]] ${r.summary}`);
  const glossary = [
    "Stable context you may reference (do not restate unless asked):",
    ...glossaryLines
  ].join("\n");

  // Insert/update a system message at the top.
  const sysMsg: ChatMessage = { role: "system", content: glossary };

  // Keep existing system messages (but place our memory first)
  const nonSystem = messages.filter(m => m.role !== "system");
  const systemExisting = messages.filter(m => m.role === "system");

  let newMessages: ChatMessage[] = [sysMsg, ...systemExisting, ...nonSystem];

  if (aggressive) {
    // Aggressive compaction: drop older assistant messages except last 1 (keeps immediate context)
    const lastAssistantIdx = newMessages.map(m => m.role).lastIndexOf("assistant");
    const keepAssistantFrom = Math.max(0, lastAssistantIdx); // keep last assistant only
    const pruned: ChatMessage[] = [];
    for (let i = 0; i < newMessages.length; i++) {
      const m = newMessages[i];
      if (m.role === "assistant" && i < keepAssistantFrom) continue;
      pruned.push(m);
    }
    newMessages = pruned;
  }

  return {
    messages: newMessages,
    refsUsed: refs.map(r => r.id)
  };
}
