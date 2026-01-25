/**
 * Token estimation for dry-run/proof mode.
 * Estimates tokens without making actual LLM provider calls.
 */

import type { ChatMessage } from "../optimizer/unitize.js";
import type { PathKind } from "../optimizer/spectral/types.js";

export interface TokenEstimate {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: number;
}

export interface PricingConfig {
  input_per_1k: number;
  output_per_1k: number;
}

// Rough token estimation: ~4 chars per token (conservative)
const CHARS_PER_TOKEN = 4;

/**
 * Estimate tokens from text (rough approximation).
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // Rough: 4 characters per token (conservative estimate)
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate tokens for a message array.
 */
function estimateMessageTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, msg) => {
    return sum + estimateTokens(msg.content || "");
  }, 0);
}

/**
 * Estimate baseline tokens and cost.
 */
export function estimateBaselineTokens(
  messages: ChatMessage[],
  provider: string,
  pricing: PricingConfig
): TokenEstimate {
  const inputTokens = estimateMessageTokens(messages);
  
  // Baseline output estimation:
  // - Typically 20-30% of input for chat
  // - Minimum 100 tokens, cap at 700 for safety
  const outputTokens = Math.min(700, Math.max(100, Math.floor(inputTokens * 0.3)));
  
  const totalTokens = inputTokens + outputTokens;
  const costUsd = (inputTokens / 1000) * pricing.input_per_1k + (outputTokens / 1000) * pricing.output_per_1k;
  
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
  };
}

/**
 * Estimate optimized tokens and cost.
 * Takes into account optimization level and path.
 */
export function estimateOptimizedTokens(
  optimizedMessages: ChatMessage[],
  path: PathKind,
  optimizationLevel: number,
  provider: string,
  pricing: PricingConfig
): TokenEstimate {
  const inputTokens = estimateMessageTokens(optimizedMessages);
  
  // Optimized output estimation (more aggressive):
  // - Talk: 15-25% of input, cap at 450
  // - Code: 10-20% of input, cap at 250 (patch mode)
  // - Higher optimization level = lower output estimate
  const outputMultiplier = path === "code" ? 0.20 : 0.25;
  const outputCap = path === "code" ? 250 : 450;
  
  // Adjust for optimization level (higher level = more aggressive)
  const levelAdjustment = 1.0 - (optimizationLevel * 0.05); // 0% to 20% reduction
  const baseOutput = Math.floor(inputTokens * outputMultiplier * levelAdjustment);
  
  const outputTokens = Math.min(outputCap, Math.max(60, baseOutput));
  
  const totalTokens = inputTokens + outputTokens;
  const costUsd = (inputTokens / 1000) * pricing.input_per_1k + (outputTokens / 1000) * pricing.output_per_1k;
  
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
    cost_usd: costUsd,
  };
}

/**
 * Get pricing config for a provider.
 */
export function getPricingConfig(provider: string): PricingConfig {
  // Default pricing (can be overridden by env)
  const defaults: Record<string, PricingConfig> = {
    openai: {
      input_per_1k: 0.003,
      output_per_1k: 0.015,
    },
    anthropic: {
      input_per_1k: 0.003,
      output_per_1k: 0.015,
    },
    gemini: {
      input_per_1k: 0.00025,
      output_per_1k: 0.001,
    },
    grok: {
      input_per_1k: 0.001,
      output_per_1k: 0.002,
    },
  };
  
  return defaults[provider.toLowerCase()] || defaults.openai;
}
