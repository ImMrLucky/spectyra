import { clamp01, sigmoid } from "./math";

/**
 * Combined Stability Index - Multi-operator moat
 * 
 * Combines multiple spectral signals into a single stability score:
 * - Spectral gap (lambda2) vs contradiction energy
 * - Random walk gap
 * - Heat trace complexity
 * - Curvature stats
 * - Novelty (average)
 */
export interface StabilityComponents {
  s_spectral: number; // [0,1] from lambda2 and contradiction
  s_rw: number; // [0,1] random walk gap
  s_heat: number; // [0,1] 1 - heat complexity
  s_curve: number; // [0,1] normalized curvature
  s_novelty: number; // [0,1] 1 - average novelty
}

export interface StabilityResult {
  stabilityFinal: number; // [0,1] combined score
  components: StabilityComponents;
}

/**
 * Enhanced spectral stability (lambda2 vs contradiction)
 * 
 * Improvements:
 * - Non-linear penalty for high contradiction (exponential penalty when > 0.3)
 * - Connectivity reward for high lambda2 (bonus when > 0.5)
 */
function computeSpectralComponent(lambda2: number, contradictionEnergy: number): number {
  const a = 1.8;
  const b = 3.0;
  
  // Non-linear penalty for high contradiction
  // If contradiction is very high, penalize more aggressively
  const contradictionPenalty = contradictionEnergy > 0.3 
    ? b * Math.pow(contradictionEnergy, 1.3) // Exponential penalty
    : b * contradictionEnergy;
  
  // Reward high connectivity (lambda2)
  // Higher lambda2 = better connected graph = more stable
  const lam = Math.min(1.0, lambda2);
  const connectivityReward = lambda2 > 0.5 
    ? a * lam * 1.15 // Bonus for very connected graphs
    : a * lam;
  
  const raw = connectivityReward - contradictionPenalty;
  
  // Sigmoid with adjusted centering
  return clamp01(sigmoid(raw));
}

/**
 * Normalize curvature stats to [0,1]
 * Higher curvature (less negative) = more stable
 */
function normalizeCurvature(curvatureMin: number, curvatureAvg: number): number {
  // Typical range: -5 to +5, map to [0,1]
  // More negative = less stable
  const normalized = clamp01((curvatureMin + 5) / 10);
  return normalized;
}

/**
 * Compute combined stability index
 * 
 * Weights (recommended):
 * w1=0.40 (spectral)
 * w2=0.20 (random walk)
 * w3=0.15 (heat trace)
 * w4=0.10 (curvature)
 * w5=0.15 (novelty)
 */
export function computeCombinedStabilityIndex(
  lambda2: number,
  contradictionEnergy: number,
  rwGap: number,
  heatComplexity: number,
  curvatureMin: number,
  curvatureAvg: number,
  noveltyAvg: number,
  weights?: { w1: number; w2: number; w3: number; w4: number; w5: number }
): StabilityResult {
  const w = weights || { w1: 0.40, w2: 0.20, w3: 0.15, w4: 0.10, w5: 0.15 };

  const s_spectral = computeSpectralComponent(lambda2, contradictionEnergy);
  const s_rw = clamp01(rwGap);
  const s_heat = clamp01(1 - heatComplexity);
  const s_curve = normalizeCurvature(curvatureMin, curvatureAvg);
  const s_novelty = clamp01(1 - noveltyAvg);

  const stabilityFinal = clamp01(
    w.w1 * s_spectral +
    w.w2 * s_rw +
    w.w3 * s_heat +
    w.w4 * s_curve +
    w.w5 * s_novelty
  );

  return {
    stabilityFinal,
    components: {
      s_spectral,
      s_rw,
      s_heat,
      s_curve,
      s_novelty,
    },
  };
}

/**
 * Legacy function for backward compatibility
 * Uses enhanced spectral component calculation
 */
export function computeStabilityIndex(lambda2: number, contradictionEnergy: number): number {
  return computeSpectralComponent(lambda2, contradictionEnergy);
}

/**
 * Multi-factor stability with confidence score
 * 
 * Combines spectral stability with graph structure quality metrics:
 * - Graph density (edges / max_possible_edges)
 * - Average similarity (average weight of positive edges)
 * 
 * Returns both stability index and confidence score.
 */
export function computeStabilityIndexV2(
  lambda2: number, 
  contradictionEnergy: number,
  graphDensity: number, // edges / max_possible_edges
  avgSimilarity: number  // average weight of positive edges
): { stabilityIndex: number; confidence: number } {
  
  // Base spectral stability (using enhanced calculation)
  const spectralStability = computeSpectralComponent(lambda2, contradictionEnergy);
  
  // Graph structure quality
  const structuralStability = 0.3 * graphDensity + 0.7 * avgSimilarity;
  
  // Combined stability (weighted average)
  const stabilityIndex = clamp01(0.7 * spectralStability + 0.3 * structuralStability);
  
  // Confidence based on graph quality
  // Low confidence if: very sparse graph, very low similarity, or contradictory
  const confidence = clamp01(
    (graphDensity * 0.4) + 
    (avgSimilarity * 0.3) + 
    ((1 - contradictionEnergy) * 0.3)
  );
  
  return { stabilityIndex, confidence };
}
