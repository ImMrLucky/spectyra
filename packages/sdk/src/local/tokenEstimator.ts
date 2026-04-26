/**
 * Lightweight token and cost estimation for local SDK use.
 *
 * Uses ~4 chars/token heuristic. When `getPricingSnapshot()` has entries, cost uses the registry; otherwise built-in tiers.
 */

import type { ChatMessage } from "../sharedTypes.js";
import type { ProviderPricingSnapshot } from "../pricing/types.js";
import { calculateCostFromEntry } from "../pricing/costCalculator.js";
import { resolveModelPricingEntry } from "../pricing/modelResolver.js";
import type { NormalizedUsage } from "../pricing/types.js";

const CHARS_PER_TOKEN = 4;

export function estimateTokens(messages: ChatMessage[]): number {
  let totalChars = 0;
  for (const m of messages) {
    totalChars += m.role.length + (m.content?.length ?? 0) + 4; // role + content + framing
  }
  return Math.ceil(totalChars / CHARS_PER_TOKEN);
}

/**
 * Cost estimation in USD — prefers registry snapshot when resolvable.
 */
export function estimateCost(
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  snapshot?: ProviderPricingSnapshot | null,
): number {
  if (snapshot?.entries?.length) {
    const warnings: string[] = [];
    const entry = resolveModelPricingEntry(snapshot.entries, provider, model, warnings);
    if (entry) {
      const usage: NormalizedUsage = {
        provider,
        modelId: model,
        inputTokens,
        outputTokens,
      };
      return calculateCostFromEntry(usage, entry, warnings).total;
    }
  }
  return estimateCostLegacy(provider, model, inputTokens, outputTokens);
}

interface TokenPricing {
  inputPer1k: number;
  outputPer1k: number;
}

function estimateCostLegacy(provider: string, model: string, inputTokens: number, outputTokens: number): number {
  const pricing = getPricingLegacy(provider, model);
  return (inputTokens * pricing.inputPer1k) / 1000 + (outputTokens * pricing.outputPer1k) / 1000;
}

function getPricingLegacy(provider: string, model: string): TokenPricing {
  const key = `${provider}/${model}`.toLowerCase();

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

  return { inputPer1k: 0.003, outputPer1k: 0.015 };
}
