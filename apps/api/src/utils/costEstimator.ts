import { config } from "../config.js";
import type { Usage } from "@spectyra/shared";

export function estimateCost(usage: Usage, provider: string): number {
  const pricing = config.pricing[provider as keyof typeof config.pricing];
  if (!pricing) return 0;
  
  const inputCost = (usage.input_tokens / 1000) * pricing.input;
  const outputCost = (usage.output_tokens / 1000) * pricing.output;
  return inputCost + outputCost;
}
