/**
 * RefPack + Inline Replacement
 * 
 * Core Moat v1: Replace repeated historical content with compact numeric references
 * - System block: REFPACK { 1: "...", 2: "..." }
 * - Inline: [[R1]], [[R2]]
 */

import { PathKind, SemanticUnit } from "../spectral/types";
import { ChatMessage } from "../unitize";
import { SpectralResult } from "../spectral/types";
import { replaceOnlyOutsideCodeFences, isInsideCodeFence } from "./textGuards";

export interface RefPack {
  entries: Array<{ id: number; summary: string; originalId: string }>;
}

export interface RefPackInput {
  units: SemanticUnit[];
  spectral: SpectralResult;
  path: PathKind;
  maxEntries?: number;
  /** Optional: full message text to count references (v2: only include if refs >= 2 or block > 300 chars). */
  messageText?: string;
}

export interface RefPackOutput {
  refPack: RefPack;
  tokensBefore: number;
  tokensAfter: number;
}

export interface ApplyInlineRefsInput {
  messages: ChatMessage[];
  refPack: RefPack;
  spectral: SpectralResult;
  units: SemanticUnit[]; // Needed to find original text for replacement
}

export interface ApplyInlineRefsOutput {
  messages: ChatMessage[];
  replacementsMade: number;
}

/** v2: summary length 40-80 chars (was 140-180). */
const REFPACK_SUMMARY_MAX_CHARS = 80;
const REFPACK_MIN_BLOCK_CHARS = 300;
const REFPACK_MIN_REFERENCES = 2;

/**
 * Build RefPack from stable units (v2: ultra-short summaries, only net-positive entries).
 * Only include entries referenced >= 2 times OR block > 300 chars.
 */
export function buildRefPack(input: RefPackInput): RefPackOutput {
  const { units, spectral, path, maxEntries = 10, messageText } = input;

  // Get stable units (already filtered by spectral)
  const stableUnitIds = new Set(spectral.stableNodeIdx.map(idx => units[idx]?.id).filter(Boolean));
  const stableUnits = units.filter(u => stableUnitIds.has(u.id));

  // Sort by stability score (highest first), then recency
  const sorted = [...stableUnits].sort((a, b) => {
    if (a.stabilityScore !== b.stabilityScore) {
      return b.stabilityScore - a.stabilityScore;
    }
    return b.createdAtTurn - a.createdAtTurn;
  });

  // v2: filter to entries that are referenced >= 2 times OR replace big blocks (> 300 chars)
  const fullText = messageText ?? units.map(u => u.text).join(" ");
  const capped = sorted.slice(0, maxEntries).filter((unit) => {
    if (unit.text.length >= REFPACK_MIN_BLOCK_CHARS) return true;
    let count = 0;
    let pos = 0;
    while ((pos = fullText.indexOf(unit.text, pos)) !== -1) {
      count++;
      pos += 1;
      if (count >= REFPACK_MIN_REFERENCES) return true;
    }
    return false;
  });

  // Generate compact summaries (v2: 40-80 chars)
  const entries = capped.map((unit, idx) => {
    const summary = summarizeUnit(unit.text, REFPACK_SUMMARY_MAX_CHARS);
    return {
      id: idx + 1,
      summary,
      originalId: unit.id,
    };
  });

  // Estimate tokens before/after (v2: compact format)
  const tokensBefore = estimateTokens(units.map(u => u.text).join(" "));
  const refPackText = entries.map(e => `${e.id}|${e.summary}`).join("\n");
  const tokensAfter = estimateTokens(`REFPACK\n${refPackText}\nUse [[R#]] as aliases.`);

  return {
    refPack: { entries },
    tokensBefore,
    tokensAfter,
  };
}

/**
 * Apply inline replacements: replace repeated chunks with [[R#]] + tiny label
 */
export function applyInlineRefs(input: ApplyInlineRefsInput): ApplyInlineRefsOutput {
  const { messages, refPack, spectral, units } = input;

  if (refPack.entries.length === 0) {
    return { messages, replacementsMade: 0 };
  }

  let replacementsMade = 0;
  const newMessages: ChatMessage[] = [];

  // Build a map of original unit IDs to ref numbers
  const originalIdToRef = new Map<string, number>();
  refPack.entries.forEach(entry => {
    originalIdToRef.set(entry.originalId, entry.id);
  });

  // Process each message
  for (const msg of messages) {
    // Skip system messages (we'll add REFPACK separately)
    if (msg.role === "system") {
      newMessages.push(msg);
      continue;
    }

    let content = msg.content;
    let changed = false;

    // For each ref entry, try to find and replace matching text
    // We look for exact matches or very similar substrings
    // IMPORTANT: Skip replacements inside code fences
    for (const entry of refPack.entries) {
      // Find the unit by ID to get original text
      const unit = units.find(u => u.id === entry.originalId);
      if (!unit) continue;

      const originalText = unit.text;
      if (!originalText || originalText.length < 20) continue; // Skip very short units

      // Safety check: skip if originalText appears inside a code fence
      if (isInsideCodeFence(content, originalText)) {
        continue;
      }

      // Apply replacement only outside code fences
      const ref = `[[R${entry.id}]]`;
      const newContent = replaceOnlyOutsideCodeFences(content, (text) => {
        if (text.includes(originalText)) {
          return text.replace(originalText, ref);
        }
        return text;
      });

      if (newContent !== content) {
        content = newContent;
        changed = true;
        replacementsMade++;
      }
    }

    newMessages.push({
      ...msg,
      content: changed ? content : msg.content,
    });
  }

  // Add REFPACK system message at the top
  const refPackContent = buildRefPackSystemMessage(refPack);
  const refPackMsg: ChatMessage = { role: "system", content: refPackContent };

  // Insert REFPACK before other system messages
  const systemMsgs = newMessages.filter(m => m.role === "system");
  const nonSystemMsgs = newMessages.filter(m => m.role !== "system");
  const finalMessages = [refPackMsg, ...systemMsgs, ...nonSystemMsgs];

  return {
    messages: finalMessages,
    replacementsMade,
  };
}

/**
 * Generate compact summary (8-25 words)
 */
function summarizeUnit(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  
  // Try to get 8-25 words
  const words = cleaned.split(" ");
  if (words.length <= 25) {
    return cleaned.slice(0, maxChars);
  }
  
  // Take first 20 words and add ellipsis
  const summary = words.slice(0, 20).join(" ");
  return summary.slice(0, maxChars - 1) + "…";
}

/** v2: compact format — 1|<summary> (no quotes, no extra whitespace). */
function buildRefPackSystemMessage(refPack: RefPack): string {
  const entries = refPack.entries.map(e => `${e.id}|${e.summary}`).join("\n");
  return `REFPACK\n${entries}\nUse [[R1]], [[R2]], etc. as exact aliases.`;
}


/**
 * Estimate tokens (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
