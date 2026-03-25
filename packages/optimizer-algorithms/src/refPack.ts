import type { SemanticUnit, SpectralResult, PathKind, ChatMsg } from "./types.js";
import { replaceOnlyOutsideCodeFences, isInsideCodeFence } from "./textGuards.js";
import { estimateTokens } from "./math.js";

export interface RefPack {
  entries: Array<{ id: number; summary: string; originalId: string }>;
}

export interface RefPackInput {
  units: SemanticUnit[];
  spectral: SpectralResult;
  path: PathKind;
  maxEntries?: number;
  messageText?: string;
}

export interface RefPackOutput {
  refPack: RefPack;
  tokensBefore: number;
  tokensAfter: number;
}

export interface ApplyInlineRefsInput {
  messages: ChatMsg[];
  refPack: RefPack;
  spectral: SpectralResult;
  units: SemanticUnit[];
  omitDictionary?: boolean;
}

export interface ApplyInlineRefsOutput {
  messages: ChatMsg[];
  replacementsMade: number;
}

const REFPACK_SUMMARY_MAX_CHARS = 80;
const REFPACK_MIN_BLOCK_CHARS = 300;
const REFPACK_MIN_REFERENCES = 2;

function summarizeUnit(text: string, maxChars: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const words = cleaned.split(" ");
  if (words.length <= 25) return cleaned.slice(0, maxChars);
  const summary = words.slice(0, 20).join(" ");
  return summary.slice(0, maxChars - 1) + "…";
}

export function buildRefPack(input: RefPackInput): RefPackOutput {
  const { units, spectral, path, maxEntries = 10, messageText } = input;
  const stableUnitIds = new Set(spectral.stableNodeIdx.map(idx => units[idx]?.id).filter(Boolean));
  const stableUnits = units.filter(u => stableUnitIds.has(u.id));
  const sorted = [...stableUnits].sort((a, b) => {
    if (a.stabilityScore !== b.stabilityScore) return b.stabilityScore - a.stabilityScore;
    return b.createdAtTurn - a.createdAtTurn;
  });
  const fullText = messageText ?? units.map(u => u.text).join(" ");
  const capped = sorted.slice(0, maxEntries).filter((unit) => {
    if (unit.text.length >= REFPACK_MIN_BLOCK_CHARS) return true;
    let count = 0;
    let pos = 0;
    while ((pos = fullText.indexOf(unit.text, pos)) !== -1) { count++; pos += 1; if (count >= REFPACK_MIN_REFERENCES) return true; }
    return false;
  });
  const entries = capped.map((unit, idx) => ({
    id: idx + 1, summary: summarizeUnit(unit.text, REFPACK_SUMMARY_MAX_CHARS), originalId: unit.id,
  }));
  const tokensBefore = estimateTokens(units.map(u => u.text).join(" "));
  const refPackText = entries.map(e => `${e.id}|${e.summary}`).join("\n");
  const tokensAfter = estimateTokens(`REFPACK\n${refPackText}\nUse [[R#]] as aliases.`);
  return { refPack: { entries }, tokensBefore, tokensAfter };
}

export function applyInlineRefs(input: ApplyInlineRefsInput): ApplyInlineRefsOutput {
  const { messages, refPack, spectral, units, omitDictionary = true } = input;
  if (refPack.entries.length === 0) return { messages, replacementsMade: 0 };
  let replacementsMade = 0;
  const newMessages: ChatMsg[] = [];
  for (const msg of messages) {
    if (msg.role === "system") { newMessages.push(msg); continue; }
    let content = msg.content;
    let changed = false;
    for (const entry of refPack.entries) {
      const unit = units.find(u => u.id === entry.originalId);
      if (!unit) continue;
      const originalText = unit.text;
      if (!originalText || originalText.length < 20) continue;
      if (isInsideCodeFence(content, originalText)) continue;
      const ref = `[[R${entry.id}]]`;
      const newContent = replaceOnlyOutsideCodeFences(content, (text) => {
        if (text.includes(originalText)) return text.replace(originalText, ref);
        return text;
      });
      if (newContent !== content) { content = newContent; changed = true; replacementsMade++; }
    }
    newMessages.push({ ...msg, content: changed ? content : msg.content });
  }
  if (omitDictionary) return { messages: newMessages, replacementsMade };
  const refPackContent = buildRefPackSystemMessage(refPack);
  const refPackMsg: ChatMsg = { role: "system", content: refPackContent };
  const systemMsgs = newMessages.filter(m => m.role === "system");
  const nonSystemMsgs = newMessages.filter(m => m.role !== "system");
  return { messages: [refPackMsg, ...systemMsgs, ...nonSystemMsgs], replacementsMade };
}

export function buildRefPackSystemMessage(refPack: RefPack): string {
  const entries = refPack.entries.map((e) => `${e.id}|${e.summary}`).join("\n");
  return `REFPACK\n${entries}\nUse [[R1]], [[R2]], etc. as exact aliases.`;
}
