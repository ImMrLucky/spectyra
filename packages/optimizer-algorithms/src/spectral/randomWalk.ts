import type { SignedGraph } from "../types.js";
import { matVec, rayleighQuotient, orthogonalizeToOnes } from "./powerIteration.js";
import { normalize } from "../math.js";

function buildTransitionMatrix(n: number, edges: SignedGraph["edges"]): number[][] {
  const W: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (const e of edges) {
    if (e.w > 0) {
      W[e.i][e.j] += e.w;
      W[e.j][e.i] += e.w;
    }
  }
  const P: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    const rowSum = W[i].reduce((sum, w) => sum + w, 0);
    if (rowSum > 0) {
      for (let j = 0; j < n; j++) P[i][j] = W[i][j] / rowSum;
    } else {
      P[i][i] = 1.0;
    }
  }
  return P;
}

function estimateLambda2P(P: number[][], maxIters: number = 30): number {
  const n = P.length;
  if (n <= 1) return 0;
  let v = new Array(n).fill(0).map(() => Math.random() - 0.5);
  v = orthogonalizeToOnes(v);
  v = normalize(v);
  for (let iter = 0; iter < maxIters; iter++) {
    const Pv = matVec(P, v);
    const mean = Pv.reduce((sum, x) => sum + x, 0) / n;
    const deflated = Pv.map(x => x - mean);
    const norm = Math.sqrt(deflated.reduce((sum, x) => sum + x * x, 0));
    if (norm < 1e-10) break;
    v = deflated.map(x => x / norm);
  }
  const lambda2 = Math.abs(rayleighQuotient(P, v));
  return lambda2;
}

export function computeRandomWalkGap(graph: SignedGraph): number {
  if (graph.n <= 1 || graph.edges.length === 0) return 0.5;
  const P = buildTransitionMatrix(graph.n, graph.edges);
  const lambda2P = estimateLambda2P(P, 30);
  return Math.max(0, Math.min(1, 1 - lambda2P));
}
