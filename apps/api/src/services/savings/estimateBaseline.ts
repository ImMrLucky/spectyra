import { getBaselineSample, findNearestWorkloadKey } from "./baselineSampler.js";

const MIN_SAMPLES = 10; // Minimum samples needed for reliable estimation

export interface BaselineEstimate {
  totalTokens: number;
  costUsd: number;
  source: "sample" | "nearest" | "fallback";
  sampleSize: number;
}

/**
 * Estimate baseline tokens and cost for an optimized run.
 * Returns estimate with source information.
 */
export async function estimateBaseline(
  workloadKey: string,
  path: string,
  provider: string,
  model: string,
  orgId?: string,
  projectId?: string | null
): Promise<BaselineEstimate> {
  // Try primary workload key
  const sample = await getBaselineSample(workloadKey);
  
  if (sample && sample.n >= MIN_SAMPLES) {
    return {
      totalTokens: sample.mean_total_tokens,
      costUsd: sample.mean_cost_usd,
      source: "sample",
      sampleSize: sample.n,
    };
  }
  
  // Try nearest workload key (same path/provider/model, different bucket)
  const nearest = await findNearestWorkloadKey(workloadKey, path, provider, model, orgId, projectId);
  
  if (nearest && nearest.n >= MIN_SAMPLES) {
    return {
      totalTokens: nearest.mean_total_tokens,
      costUsd: nearest.mean_cost_usd,
      source: "nearest",
      sampleSize: nearest.n,
    };
  }
  
  // Fallback: use global defaults per provider/model/path
  // These should be configured based on historical data
  // For MVP, use conservative estimates
  const fallbackTokens = getFallbackTokens(path, provider, model);
  const fallbackCost = getFallbackCost(path, provider, model);
  
  return {
    totalTokens: fallbackTokens,
    costUsd: fallbackCost,
    source: "fallback",
    sampleSize: 0,
  };
}

/**
 * Get fallback token estimate based on path/provider/model.
 * These are conservative defaults when no samples exist.
 */
function getFallbackTokens(path: string, provider: string, model: string): number {
  // Conservative estimates: assume baseline would use ~2000 tokens for typical request
  // Adjust based on provider/model characteristics
  const baseTokens = path === "code" ? 3000 : 2000;
  
  // Model-specific adjustments (rough estimates)
  if (model.includes("gpt-4") || model.includes("claude-3-5")) {
    return baseTokens * 1.2;
  }
  if (model.includes("gpt-3.5") || model.includes("claude-3-haiku")) {
    return baseTokens * 0.8;
  }
  
  return baseTokens;
}

/**
 * Get fallback cost estimate.
 */
function getFallbackCost(path: string, provider: string, model: string): number {
  const tokens = getFallbackTokens(path, provider, model);
  
  // Rough cost per 1K tokens (adjust based on actual pricing)
  let costPer1K = 0.01; // default
  
  if (provider === "openai") {
    if (model.includes("gpt-4")) {
      costPer1K = 0.03; // input, adjust for output
    } else {
      costPer1K = 0.0015;
    }
  } else if (provider === "anthropic") {
    costPer1K = 0.015;
  } else if (provider === "gemini") {
    costPer1K = 0.0005;
  }
  
  return (tokens / 1000) * costPer1K;
}
