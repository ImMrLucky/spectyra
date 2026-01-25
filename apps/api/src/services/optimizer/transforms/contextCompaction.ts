import { PathKind, SemanticUnit } from "../spectral/types";
import { ChatMessage } from "../unitize";

export interface ContextCompactionInput {
  path: PathKind;
  messages: ChatMessage[];
  units: SemanticUnit[];
  stableUnitIds: string[];
  aggressive: boolean;
  maxRefs: number; // Cap glossary REFs to this many stable units
  keepLastTurns: number; // Keep at most this many turns (user+assistant pairs)
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
 * Sort stable units by stability score (highest first), then by recency (most recent first)
 */
function sortStableUnits(units: SemanticUnit[]): SemanticUnit[] {
  return [...units].sort((a, b) => {
    // First by stability score (if available)
    if (a.stabilityScore !== b.stabilityScore) {
      return b.stabilityScore - a.stabilityScore;
    }
    // Then by recency (higher turn index = more recent)
    return b.createdAtTurn - a.createdAtTurn;
  });
}

/**
 * Count turns in messages (user+assistant pairs)
 */
function countTurns(messages: ChatMessage[]): number {
  let turns = 0;
  let lastUserIdx = -1;
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "user") {
      lastUserIdx = i;
    } else if (messages[i].role === "assistant" && lastUserIdx >= 0) {
      turns++;
    }
  }
  return turns;
}

/**
 * Prune messages to keep only the last N turns
 * Always keeps the most recent user message even if it doesn't have a pair yet
 */
function keepLastTurns(messages: ChatMessage[], keepTurns: number): ChatMessage[] {
  if (keepTurns <= 0) {
    // Keep only system messages and the last user message
    const system = messages.filter(m => m.role === "system");
    const lastUser = messages.filter(m => m.role === "user").slice(-1);
    return [...system, ...lastUser];
  }

  // Find all user+assistant pairs from the end
  const pairs: { userIdx: number; assistantIdx: number | null }[] = [];
  let lastUserIdx = -1;
  
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "assistant" && lastUserIdx >= 0) {
      pairs.unshift({ userIdx: lastUserIdx, assistantIdx: i });
      lastUserIdx = -1;
    } else if (messages[i].role === "user") {
      lastUserIdx = i;
    }
  }

  // Keep only the last keepTurns pairs
  const keepPairs = pairs.slice(-keepTurns);
  const keepIndices = new Set<number>();
  
  // Always keep system messages
  messages.forEach((m, i) => {
    if (m.role === "system") keepIndices.add(i);
  });

  // Keep indices from the pairs we want
  keepPairs.forEach(pair => {
    keepIndices.add(pair.userIdx);
    if (pair.assistantIdx !== null) keepIndices.add(pair.assistantIdx);
  });

  // Always keep the most recent user message (even if no assistant yet)
  const lastUser = messages.filter(m => m.role === "user").slice(-1);
  if (lastUser.length > 0) {
    const lastUserIdx = messages.indexOf(lastUser[0]);
    if (lastUserIdx >= 0) keepIndices.add(lastUserIdx);
  }

  return messages.filter((_, i) => keepIndices.has(i));
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
  const { path, messages, units, stableUnitIds, aggressive, maxRefs, keepLastTurns } = input;

  // Find and sort stable units (by stability, then recency)
  const stableUnits = sortStableUnits(findStableUnits(units, stableUnitIds));
  
  // Cap to maxRefs (prefer highest stability + most recent)
  const cappedStableUnits = stableUnits.slice(0, maxRefs);
  
  if (cappedStableUnits.length === 0) {
    // Still apply keepLastTurns even if no REFs
    const prunedMessages = keepLastTurns(messages, keepLastTurns);
    return { messages: prunedMessages, refsUsed: [] };
  }

  const refs = cappedStableUnits.map(u => ({
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

  // Apply keepLastTurns pruning (always, not just in aggressive mode)
  newMessages = keepLastTurns(newMessages, keepLastTurns);

  if (aggressive) {
    // Additional aggressive compaction: drop older assistant messages except last 1
    // (keepLastTurns already pruned, but we can be even more aggressive)
    const lastAssistantIdx = newMessages.map(m => m.role).lastIndexOf("assistant");
    if (lastAssistantIdx >= 0) {
      const pruned: ChatMessage[] = [];
      for (let i = 0; i < newMessages.length; i++) {
        const m = newMessages[i];
        // Keep system messages, keep last assistant, keep all user messages
        if (m.role === "system" || m.role === "user" || i === lastAssistantIdx) {
          pruned.push(m);
        }
      }
      newMessages = pruned;
    }
  }

  return {
    messages: newMessages,
    refsUsed: refs.map(r => r.id)
  };
}
