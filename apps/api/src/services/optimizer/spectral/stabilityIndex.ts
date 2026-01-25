import { clamp01, sigmoid } from "./math";

/**
 * contradictionEnergy: sum of |negative edges| normalized by total abs edge weight
 * lambda2: coherence (higher => more connected / stable)
 *
 * Index increases with lambda2 and decreases with contradiction energy.
 */
export function computeStabilityIndex(lambda2: number, contradictionEnergy: number): number {
  // Tunable weights (keep simple for MVP)
  const a = 1.8; // lambda2 weight
  const b = 3.0; // contradiction weight

  // normalize lambda2 somewhat (Laplacian values depend on weights)
  const lam = Math.min(1.0, lambda2); // cap for MVP
  const x = a * lam - b * contradictionEnergy;
  return clamp01(sigmoid(x));
}
