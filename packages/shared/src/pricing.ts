export interface PricingConfig {
  [provider: string]: {
    input: number; // USD per 1K tokens
    output: number;
  };
}

export function estimateCost(
  usage: { input_tokens: number; output_tokens: number },
  provider: string,
  pricing: PricingConfig
): number {
  const config = pricing[provider];
  if (!config) return 0;
  
  const inputCost = (usage.input_tokens / 1000) * config.input;
  const outputCost = (usage.output_tokens / 1000) * config.output;
  return inputCost + outputCost;
}
