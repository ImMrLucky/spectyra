import { getBaselineSample } from "./baselineSampler.js";

/**
 * Compute confidence score for estimated savings.
 * Returns value 0..1 where 1.0 = verified, lower = less confident.
 */
export async function computeConfidence(
  workloadKey: string,
  savingsType: "verified" | "shadow_verified" | "estimated",
  orgId?: string,
  projectId?: string | null
): Promise<number> {
  // Verified and shadow_verified always have full confidence
  if (savingsType === "verified" || savingsType === "shadow_verified") {
    return 1.0;
  }
  
  // For estimated, compute based on sample quality
  const sample = await getBaselineSample(workloadKey);
  
  if (!sample || sample.n === 0) {
    return 0.15; // Minimum confidence for fallback estimates
  }
  
  // Compute coefficient of variation (CV) = std/mean
  const meanTokens = sample.mean_total_tokens;
  const stdTokens = Math.sqrt(sample.var_total_tokens);
  const cv = meanTokens > 0 ? stdTokens / meanTokens : 2.0;
  const clampedCv = Math.min(2.0, Math.max(0, cv));
  
  // Days since last update
  const updatedAt = new Date(sample.updated_at);
  const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Confidence components
  // Sample confidence: rises with n, ~0.63 at n=10, ~0.95 at n=30
  const sampleConf = clamp01(1 - Math.exp(-sample.n / 10));
  
  // Stability confidence: high variance reduces confidence
  const stabilityConf = clamp01(1 - clampedCv);
  
  // Recency confidence: decays over 30 days
  const recencyConf = clamp01(1 - daysSinceUpdate / 30);
  
  // Weighted combination
  const confidence = 0.15 + 0.55 * sampleConf + 0.20 * stabilityConf + 0.10 * recencyConf;
  
  return clamp01(confidence);
}

/**
 * Convert confidence score to human-readable band.
 */
export function confidenceToBand(confidence: number): "High" | "Medium" | "Low" {
  if (confidence >= 0.85) return "High";
  if (confidence >= 0.70) return "Medium";
  return "Low";
}

function clamp01(x: number): number {
  if (Number.isNaN(x) || !Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}
