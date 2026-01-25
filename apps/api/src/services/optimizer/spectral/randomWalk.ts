/**
 * Random Walk Operator - Markov chain analysis
 * 
 * Builds transition matrix from positive edges and estimates lambda2_P
 * (second-largest eigenvalue magnitude) to measure mixing/gap.
 */

import type { SignedGraph } from "./types.js";
import { matVec, rayleighQuotient, orthogonalizeToOnes, normalize } from "./powerIteration.js";

/**
 * Build transition matrix P from positive edges only
 * P_ij ∝ max(0, w_ij) then row-normalize
 */
function buildTransitionMatrix(n: number, edges: SignedGraph["edges"]): number[][] {
  // Build adjacency with only positive weights
  const W: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (const e of edges) {
    if (e.w > 0) {
      W[e.i][e.j] += e.w;
      W[e.j][e.i] += e.w; // Symmetric
    }
  }

  // Row-normalize to get transition probabilities
  const P: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    const rowSum = W[i].reduce((sum, w) => sum + w, 0);
    if (rowSum > 0) {
      for (let j = 0; j < n; j++) {
        P[i][j] = W[i][j] / rowSum;
      }
    } else {
      // Isolated node: self-loop
      P[i][i] = 1.0;
    }
  }

  return P;
}

/**
 * Estimate lambda2_P (second-largest eigenvalue magnitude) of transition matrix P
 * Uses power iteration with deflation
 */
function estimateLambda2P(P: number[][], maxIters: number = 30): number {
  const n = P.length;
  if (n <= 1) return 0;

  // First eigenvalue is always 1 (stationary distribution)
  // We want the second-largest magnitude

  // Start with random vector orthogonal to constant vector
  let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
  v = orthogonalizeToOnes(v);
  v = normalize(v);

  const step = 0.1;
  
  for (let iter = 0; iter < maxIters; iter++) {
    const Pv = matVec(P, v);
    
    // Deflate: remove component in direction of stationary (uniform) distribution
    const mean = Pv.reduce((sum, x) => sum + x, 0) / n;
    const deflated = Pv.map(x => x - mean);
    
    // Normalize
    const norm = Math.sqrt(deflated.reduce((sum, x) => sum + x * x, 0));
    if (norm < 1e-10) break;
    
    v = deflated.map(x => x / norm);
  }

  // Compute eigenvalue estimate
  const Pv = matVec(P, v);
  const lambda2 = Math.abs(rayleighQuotient(P, v));
  
  return lambda2;
}

/**
 * Compute random walk gap
 * rwGap = clamp01(1 - abs(lambda2_P))
 * 
 * High rwGap => well-mixing stable state => safe REUSE
 * Low rwGap => topic split/drift => avoid over-compaction
 */
export function computeRandomWalkGap(graph: SignedGraph): number {
  if (graph.n <= 1 || graph.edges.length === 0) {
    return 0.5; // Default to medium gap
  }

  const P = buildTransitionMatrix(graph.n, graph.edges);
  const lambda2P = estimateLambda2P(P, 30);
  
  // Gap = 1 - |lambda2|
  const gap = Math.max(0, Math.min(1, 1 - lambda2P));
  
  return gap;
}
