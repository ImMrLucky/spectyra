/**
 * Heat Trace Complexity Proxy
 * 
 * Estimates Tr(exp(-tL)) using Hutchinson estimator with probe vectors.
 * Higher complexity => less compressible => reduce REUSE aggressiveness
 */

import type { SignedGraph } from "./types.js";
import { buildSignedLaplacian } from "./signedLaplacian.js";
import { matVec } from "./powerIteration.js";
import { clamp01 } from "./math.js";

/**
 * Approximate exp(-tL)z using truncated series
 * exp(-tL) ≈ I - tL + (tL)²/2 - (tL)³/6 + ...
 * For small t, we use a few terms
 */
function approximateExpMinusTL(
  L: number[][],
  z: number[],
  t: number,
  maxTerms: number = 4
): number[] {
  const n = L.length;
  let result = [...z]; // I * z
  let term = [...z];
  let factorial = 1;

  for (let k = 1; k <= maxTerms; k++) {
    factorial *= k;
    const sign = k % 2 === 0 ? 1 : -1;
    term = matVec(L, term);
    const coeff = (sign * Math.pow(t, k)) / factorial;
    
    for (let i = 0; i < n; i++) {
      result[i] += coeff * term[i];
    }
  }

  return result;
}

/**
 * Hutchinson estimator for Tr(exp(-tL))
 * Uses k probe vectors with entries ±1
 */
function hutchinsonTrace(
  L: number[][],
  t: number,
  k: number = 8
): number {
  const n = L.length;
  let traceEstimate = 0;

  for (let probe = 0; probe < k; probe++) {
    // Generate random ±1 vector
    const z = new Array(n).fill(0).map(() => (Math.random() < 0.5 ? -1 : 1));
    
    // Compute exp(-tL)z
    const expLz = approximateExpMinusTL(L, z, t, 4);
    
    // z^T * exp(-tL)z
    let dot = 0;
    for (let i = 0; i < n; i++) {
      dot += z[i] * expLz[i];
    }
    
    traceEstimate += dot;
  }

  return traceEstimate / k;
}

/**
 * Compute heat trace complexity for two time scales
 * Returns normalized complexity [0, 1]
 */
export function computeHeatTraceComplexity(graph: SignedGraph): number {
  if (graph.n <= 1 || graph.edges.length === 0) {
    return 0.5; // Default medium complexity
  }

  const { L } = buildSignedLaplacian(graph.n, graph.edges);
  
  // Compute for two time scales
  const t1 = 0.5;
  const t2 = 1.0;
  
  const trace1 = hutchinsonTrace(L, t1, 8);
  const trace2 = hutchinsonTrace(L, t2, 8);
  
  // Normalize: higher trace = higher complexity
  // For Laplacian, trace is roughly n for small t, grows with complexity
  const normalized = (trace1 + trace2) / (2 * graph.n);
  
  // Map to [0, 1] with reasonable bounds
  // Typical range: 0.5 to 2.0 for normalized trace
  const low = 0.5;
  const high = 2.0;
  const complexity = clamp01((normalized - low) / (high - low));
  
  return complexity;
}
