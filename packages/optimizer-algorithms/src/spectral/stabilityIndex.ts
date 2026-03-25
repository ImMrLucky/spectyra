import { clamp01, sigmoid } from "../math.js";

export interface StabilityComponents {
  s_spectral: number;
  s_rw: number;
  s_heat: number;
  s_curve: number;
  s_novelty: number;
}

export interface StabilityResult {
  stabilityFinal: number;
  components: StabilityComponents;
}

function computeSpectralComponent(lambda2: number, contradictionEnergy: number): number {
  const a = 1.8;
  const b = 3.0;
  const contradictionPenalty = contradictionEnergy > 0.3
    ? b * Math.pow(contradictionEnergy, 1.3)
    : b * contradictionEnergy;
  const lam = Math.min(1.0, lambda2);
  const connectivityReward = lambda2 > 0.5
    ? a * lam * 1.15
    : a * lam;
  const raw = connectivityReward - contradictionPenalty;
  return clamp01(sigmoid(raw));
}

function normalizeCurvature(curvatureMin: number, _curvatureAvg: number): number {
  return clamp01((curvatureMin + 5) / 10);
}

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
    w.w1 * s_spectral + w.w2 * s_rw + w.w3 * s_heat + w.w4 * s_curve + w.w5 * s_novelty
  );
  return { stabilityFinal, components: { s_spectral, s_rw, s_heat, s_curve, s_novelty } };
}

export function computeStabilityIndex(lambda2: number, contradictionEnergy: number): number {
  return computeSpectralComponent(lambda2, contradictionEnergy);
}

export function computeStabilityIndexV2(
  lambda2: number,
  contradictionEnergy: number,
  graphDensity: number,
  avgSimilarity: number
): { stabilityIndex: number; confidence: number } {
  const spectralStability = computeSpectralComponent(lambda2, contradictionEnergy);
  const structuralStability = 0.3 * graphDensity + 0.7 * avgSimilarity;
  const stabilityIndex = clamp01(0.7 * spectralStability + 0.3 * structuralStability);
  const confidence = clamp01(
    (graphDensity * 0.4) + (avgSimilarity * 0.3) + ((1 - contradictionEnergy) * 0.3)
  );
  return { stabilityIndex, confidence };
}
