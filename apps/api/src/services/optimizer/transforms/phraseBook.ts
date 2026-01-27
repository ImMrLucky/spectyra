/**
 * PhraseBook Encoding
 * 
 * Core Moat v1: Encode repeated phrases to short symbols
 * - Prompt includes PHRASEBOOK { 1:"...", 2:"..." }
 * - Replace phrase occurrences with ⟦P1⟧
 */

import { ChatMessage } from "../unitize";

export interface PhraseBook {
  entries: Array<{ id: number; phrase: string; count: number }>;
}

export interface PhraseBookInput {
  messages: ChatMessage[];
  aggressiveness: number; // 0-1 scale
  minPhraseLength?: number;
  minOccurrences?: number;
}

export interface PhraseBookOutput {
  messages: ChatMessage[];
  phraseBook: PhraseBook;
  tokensBefore: number;
  tokensAfter: number;
  changed: boolean;
}

/**
 * Build local phrasebook per request
 * Finds repeated phrases and encodes them
 */
export function buildLocalPhraseBook(input: PhraseBookInput): PhraseBookOutput {
  const { messages, aggressiveness, minPhraseLength = 10, minOccurrences = 2 } = input;

  // Extract all text content
  const allText = messages
    .filter(m => m.role !== "system") // Skip system messages for phrase detection
    .map(m => m.content)
    .join(" ");

  // Find repeated phrases
  const phrases = findRepeatedPhrases(allText, minPhraseLength, minOccurrences);

  // Filter by aggressiveness (higher = more phrases)
  const maxPhrases = Math.max(3, Math.ceil(phrases.length * aggressiveness));
  const selectedPhrases = phrases.slice(0, maxPhrases);

  if (selectedPhrases.length === 0) {
    return {
      messages,
      phraseBook: { entries: [] },
      tokensBefore: estimateTokens(allText),
      tokensAfter: estimateTokens(allText),
      changed: false,
    };
  }

  // Build phrasebook entries
  const entries = selectedPhrases.map((phrase, idx) => ({
    id: idx + 1,
    phrase: phrase.text,
    count: phrase.count,
  }));

  const phraseBook: PhraseBook = { entries };

  // Apply phrasebook encoding to messages
  const { newMessages, replacementsMade } = applyPhraseBookEncoding(messages, phraseBook);

  // Estimate tokens
  const tokensBefore = estimateTokens(allText);
  const phraseBookText = buildPhraseBookSystemMessage(phraseBook);
  const encodedText = newMessages.map(m => m.content).join(" ");
  const tokensAfter = estimateTokens(phraseBookText + encodedText);

  return {
    messages: newMessages,
    phraseBook,
    tokensBefore,
    tokensAfter,
    changed: replacementsMade > 0,
  };
}

/**
 * Find repeated phrases in text
 */
function findRepeatedPhrases(text: string, minLength: number, minOccurrences: number): Array<{ text: string; count: number }> {
  const phraseMap = new Map<string, number>();

  // Extract phrases of different lengths
  const words = text.split(/\s+/);
  
  // Look for phrases of 3-8 words
  for (let phraseLength = 3; phraseLength <= 8; phraseLength++) {
    for (let i = 0; i <= words.length - phraseLength; i++) {
      const phrase = words.slice(i, i + phraseLength).join(" ");
      
      if (phrase.length >= minLength) {
        phraseMap.set(phrase, (phraseMap.get(phrase) || 0) + 1);
      }
    }
  }

  // Filter by min occurrences and sort by count
  const phrases = Array.from(phraseMap.entries())
    .filter(([_, count]) => count >= minOccurrences)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);

  return phrases;
}

/**
 * Apply phrasebook encoding to messages
 */
function applyPhraseBookEncoding(messages: ChatMessage[], phraseBook: PhraseBook): {
  newMessages: ChatMessage[];
  replacementsMade: number;
} {
  let replacementsMade = 0;
  const newMessages: ChatMessage[] = [];

  for (const msg of messages) {
    // Skip system messages (we'll add phrasebook separately)
    if (msg.role === "system") {
      newMessages.push(msg);
      continue;
    }

    let content = msg.content;

    // Replace phrases with ⟦P#⟧ references
    for (const entry of phraseBook.entries) {
      const regex = new RegExp(escapeRegex(entry.phrase), "gi");
      if (regex.test(content)) {
        content = content.replace(regex, `⟦P${entry.id}⟧`);
        replacementsMade++;
      }
    }

    newMessages.push({
      ...msg,
      content,
    });
  }

  // Add PhraseBook system message at the top
  const phraseBookMsg: ChatMessage = {
    role: "system",
    content: buildPhraseBookSystemMessage(phraseBook),
  };

  // Insert before other system messages
  const systemMsgs = newMessages.filter(m => m.role === "system");
  const nonSystemMsgs = newMessages.filter(m => m.role !== "system");
  const finalMessages = [phraseBookMsg, ...systemMsgs, ...nonSystemMsgs];

  return {
    newMessages: finalMessages,
    replacementsMade,
  };
}

/**
 * Build PhraseBook system message
 */
function buildPhraseBookSystemMessage(phraseBook: PhraseBook): string {
  const entries = phraseBook.entries.map(e => `  ${e.id}: "${e.phrase}"`).join(",\n");

  return `PHRASEBOOK {
${entries}
}

Use ⟦P1⟧, ⟦P2⟧, etc. to refer to the phrases above.`;
}

/**
 * Escape regex special characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Estimate tokens
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
