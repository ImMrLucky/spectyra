/**
 * Lightweight token and cost estimation for local SDK use.
 *
 * Uses ~4 chars/token heuristic. For precise counts, the server-side
 * optimizer or provider usage data should be preferred.
 */

import type { ChatMessage } from "../sharedTypes.js";

const CHARS_PER_TOKEN = 4;

export function estimateTokens(messages: ChatMessage[]): number {
  let totalChars = 0;
  for (const m of messages) {
    totalChars += m.role.length + (m.content?.length ?? 0) + 4; // role + content + framing
  }
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

/**
 * Cost estimation using approximate per-token pricing.
 * Returns cost in USD.
 */
export function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = getPricing(provider, model);
  return (inputTokens * pricing.inputPer1k) / 1000 + (outputTokens * pricing.outputPer1k) / 1000;
}

interface TokenPricing {
  inputPer1k: number;
  outputPer1k: number;
}

function getPricing(provider: string, model: string): TokenPricing {
  const key = `${provider}/${model}`.toLowerCase();

  // Well-known pricing tiers (approximate, conservative)
  if (key.includes("gpt-4o-mini") || key.includes("gpt-4.1-mini")) {
    return { inputPer1k: 0.00015, outputPer1k: 0.0006 };
  }
  if (key.includes("gpt-4o") || key.includes("gpt-4.1")) {
    return { inputPer1k: 0.0025, outputPer1k: 0.01 };
  }
  if (key.includes("gpt-4-turbo")) {
    return { inputPer1k: 0.01, outputPer1k: 0.03 };
  }
  if (key.includes("haiku")) {
    return { inputPer1k: 0.00025, outputPer1k: 0.00125 };
  }
  if (key.includes("sonnet")) {
    return { inputPer1k: 0.003, outputPer1k: 0.015 };
  }
  if (key.includes("opus")) {
    return { inputPer1k: 0.015, outputPer1k: 0.075 };
  }
  if (key.includes("groq") || key.includes("llama")) {
    return { inputPer1k: 0.0001, outputPer1k: 0.0001 };
  }

  // Conservative fallback
  return { inputPer1k: 0.003, outputPer1k: 0.015 };
}
