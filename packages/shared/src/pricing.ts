/**
 * Pricing Configuration Types
 */

/**
 * PricingConfig for token estimation (simple per-provider config)
 * Used by apps/api/src/services/proof/tokenEstimator.ts
 */
export interface PricingConfig {
  input_per_1k: number;
  output_per_1k: number;
}

/**
 * PricingConfig for cost estimation (multi-provider config)
 * Used by packages/shared/src/pricing.ts estimateCost function
 */
export interface PricingConfigMap {
  [provider: string]: {
    input: number; // USD per 1K tokens
    output: number;
  };
}

export function estimateCost(
  usage: { input_tokens: number; output_tokens: number },
  provider: string,
  pricing: PricingConfigMap
): number {
  const config = pricing[provider];
  if (!config) return 0;
  
  const inputCost = (usage.input_tokens / 1000) * config.input;
  const outputCost = (usage.output_tokens / 1000) * config.output;
  return inputCost + outputCost;
}
