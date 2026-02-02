/**
 * Spectral Token Encoding (STE)
 *
 * Replaces PhraseBook: short numeric tokens ⟦P1⟧ with ultra-short legend (≤60 chars per entry), max 5 entries.
 * Skip if net savings < threshold (profit gate applied by optimizer).
 */

import { ChatMessage } from "../unitize";
import { replaceOnlyOutsideCodeFences } from "./textGuards";

export interface STE {
  entries: Array<{ id: number; phrase: string; legend: string; count: number }>;
}

export interface STEInput {
  messages: ChatMessage[];
  aggressiveness: number; // 0-1 scale
  minPhraseLength?: number;
  minOccurrences?: number;
}

export interface STEOutput {
  messages: ChatMessage[];
  ste: STE;
  tokensBefore: number;
  tokensAfter: number;
  changed: boolean;
}

const STE_MAX_ENTRIES = 5;
const STE_LEGEND_MAX_CHARS = 60;
const STE_MIN_LENGTH = 18;
const STE_MIN_OCCURRENCES = 3;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncateLegend(phrase: string, maxChars: number): string {
  const t = phrase.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars - 1).trim() + "…";
}

function findRepeatedPhrases(
  text: string,
  minLength: number,
  minOccurrences: number
): Array<{ text: string; count: number }> {
  const phraseMap = new Map<string, number>();
  const words = text.split(/\s+/);
  for (let phraseLength = 3; phraseLength <= 8; phraseLength++) {
    for (let i = 0; i <= words.length - phraseLength; i++) {
      const phrase = words.slice(i, i + phraseLength).join(" ");
      if (phrase.length >= minLength) {
        phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
      }
    }
  }
  return Array.from(phraseMap.entries())
    .filter(([, count]) => count >= minOccurrences)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Build STE: max 5 entries, legend ≤60 chars per entry. Skip if net savings < threshold (caller applies profit gate).
 */
export function buildSTE(input: STEInput): STEOutput {
  const {
    messages,
    aggressiveness,
    minPhraseLength = STE_MIN_LENGTH,
    minOccurrences = STE_MIN_OCCURRENCES,
  } = input;

  const allText = messages
    .filter((m) => m.role !== "system")
    .map((m) => m.content)
    .join(" ");

  const phrases = findRepeatedPhrases(allText, minPhraseLength, minOccurrences);
  const maxEntries = Math.min(STE_MAX_ENTRIES, Math.max(1, Math.ceil(phrases.length * aggressiveness)));
  const selected = phrases.slice(0, maxEntries);

  if (selected.length === 0) {
    return {
      messages,
      ste: { entries: [] },
      tokensBefore: estimateTokens(allText),
      tokensAfter: estimateTokens(allText),
      changed: false,
    };
  }

  const entries = selected.map((p, idx) => ({
    id: idx + 1,
    phrase: p.text,
    legend: truncateLegend(p.text, STE_LEGEND_MAX_CHARS),
    count: p.count,
  }));

  const ste: STE = { entries };
  const { newMessages, replacementsMade } = applySTEEncoding(messages, ste);

  const tokensBefore = estimateTokens(allText);
  const tokensAfter = newMessages.reduce((s, m) => s + estimateTokens(m.content ?? ""), 0);

  return {
    messages: newMessages,
    ste,
    tokensBefore,
    tokensAfter,
    changed: replacementsMade > 0,
  };
}

function buildSTELegend(ste: STE): string {
  if (ste.entries.length === 0) return "";
  const lines = ste.entries.map((e) => `P${e.id}|${e.legend}`).join("\n");
  return `STE\n${lines}\nUse ⟦P1⟧ etc. as aliases.\n`;
}

function applySTEEncoding(
  messages: ChatMessage[],
  ste: STE
): { newMessages: ChatMessage[]; replacementsMade: number } {
  let replacementsMade = 0;
  const newMessages: ChatMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      newMessages.push(msg);
      continue;
    }

    let content = msg.content ?? "";
    for (const entry of ste.entries) {
      const regex = new RegExp(escapeRegex(entry.phrase), "gi");
      const newContent = replaceOnlyOutsideCodeFences(content, (text) => {
        if (regex.test(text)) {
          return text.replace(regex, `⟦P${entry.id}⟧`);
        }
        return text;
      });
      if (newContent !== content) {
        content = newContent;
        replacementsMade++;
      }
    }

    newMessages.push({ ...msg, content });
  }

  const legendMsg: ChatMessage = { role: "system", content: buildSTELegend(ste) };
  const systemMsgs = newMessages.filter((m) => m.role === "system");
  const nonSystemMsgs = newMessages.filter((m) => m.role !== "system");
  const finalMessages = [legendMsg, ...systemMsgs, ...nonSystemMsgs];

  return { newMessages: finalMessages, replacementsMade };
}
