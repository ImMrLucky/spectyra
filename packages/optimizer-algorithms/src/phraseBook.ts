import type { ChatMsg } from "./types.js";
import { replaceOnlyOutsideCodeFences } from "./textGuards.js";
import { estimateTokens, escapeRegex } from "./math.js";

export interface PhraseBook {
  entries: Array<{ id: number; phrase: string; count: number }>;
}

export interface PhraseBookInput {
  messages: ChatMsg[];
  aggressiveness: number;
  minPhraseLength?: number;
  minOccurrences?: number;
}

export interface PhraseBookOutput {
  messages: ChatMsg[];
  phraseBook: PhraseBook;
  tokensBefore: number;
  tokensAfter: number;
  changed: boolean;
}

const PHRASEBOOK_MIN_LENGTH = 18;
const PHRASEBOOK_MIN_OCCURRENCES = 3;

function findRepeatedPhrases(text: string, minLength: number, minOccurrences: number): Array<{ text: string; count: number }> {
  const phraseMap = new Map<string, number>();
  const words = text.split(/\s+/);
  for (let phraseLength = 3; phraseLength <= 8; phraseLength++) {
    for (let i = 0; i <= words.length - phraseLength; i++) {
      const phrase = words.slice(i, i + phraseLength).join(" ");
      if (phrase.length >= minLength) phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
    }
  }
  return Array.from(phraseMap.entries())
    .filter(([, count]) => count >= minOccurrences)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildLocalPhraseBook(input: PhraseBookInput): PhraseBookOutput {
  const { messages, aggressiveness, minPhraseLength = PHRASEBOOK_MIN_LENGTH, minOccurrences = PHRASEBOOK_MIN_OCCURRENCES } = input;
  const allText = messages.filter(m => m.role !== "system").map(m => m.content).join(" ");
  const phrases = findRepeatedPhrases(allText, minPhraseLength, minOccurrences);
  const maxPhrases = Math.max(3, Math.ceil(phrases.length * aggressiveness));
  const selectedPhrases = phrases.slice(0, maxPhrases);
  if (selectedPhrases.length === 0) {
    return { messages, phraseBook: { entries: [] }, tokensBefore: estimateTokens(allText), tokensAfter: estimateTokens(allText), changed: false };
  }
  const entries = selectedPhrases.map((phrase, idx) => ({ id: idx + 1, phrase: phrase.text, count: phrase.count }));
  const phraseBook: PhraseBook = { entries };
  const { newMessages, replacementsMade } = applyPhraseBookEncoding(messages, phraseBook);
  const tokensBefore = estimateTokens(allText);
  const phraseBookText = buildPhraseBookSystemMessage(phraseBook);
  const encodedText = newMessages.map(m => m.content).join(" ");
  const tokensAfter = estimateTokens(phraseBookText + encodedText);
  return { messages: newMessages, phraseBook, tokensBefore, tokensAfter, changed: replacementsMade > 0 };
}

function applyPhraseBookEncoding(messages: ChatMsg[], phraseBook: PhraseBook): { newMessages: ChatMsg[]; replacementsMade: number } {
  let replacementsMade = 0;
  const newMessages: ChatMsg[] = [];
  for (const msg of messages) {
    if (msg.role === "system") { newMessages.push(msg); continue; }
    let content = msg.content;
    for (const entry of phraseBook.entries) {
      const pattern = escapeRegex(entry.phrase);
      const newContent = replaceOnlyOutsideCodeFences(content, (text) => {
        const testRe = new RegExp(pattern, "gi");
        if (testRe.test(text)) return text.replace(new RegExp(pattern, "gi"), `⟦P${entry.id}⟧`);
        return text;
      });
      if (newContent !== content) { content = newContent; replacementsMade++; }
    }
    newMessages.push({ ...msg, content });
  }
  const phraseBookMsg: ChatMsg = { role: "system", content: buildPhraseBookSystemMessage(phraseBook) };
  const systemMsgs = newMessages.filter(m => m.role === "system");
  const nonSystemMsgs = newMessages.filter(m => m.role !== "system");
  return { newMessages: [phraseBookMsg, ...systemMsgs, ...nonSystemMsgs], replacementsMade };
}

function buildPhraseBookSystemMessage(phraseBook: PhraseBook): string {
  const entries = phraseBook.entries.map((e) => `P${e.id}|${e.phrase}`).join("\n");
  return `PHRASEBOOK\n${entries}\nUse ⟦P1⟧, ⟦P2⟧, etc. as aliases.`;
}
