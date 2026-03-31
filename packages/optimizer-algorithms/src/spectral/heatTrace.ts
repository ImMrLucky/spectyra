import type { SignedGraph } from "../types.js";
import { buildSignedLaplacian } from "./signedLaplacian.js";
import { matVec } from "./powerIteration.js";
import { clamp01 } from "../math.js";

function matFrobeniusNorm(L: number[][]): number {
  const n = L.length;
  let s = 0;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) s += L[i][j] * L[i][j];
  return Math.sqrt(s);
}

function identityMatrix(n: number): number[][] {
  const I: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) I[i][i] = 1;
  return I;
}

function matMul(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const C: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let k = 0; k < n; k++) {
      const a = A[i][k];
      if (a === 0) continue;
      for (let j = 0; j < n; j++) C[i][j] += a * B[k][j];
    }
  return C;
}

function matVecFromMat(M: number[][], z: number[]): number[] {
  const n = M.length;
  const y = new Array(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) y[i] += M[i][j] * z[j];
  return y;
}

/**
 * Scaling-and-squaring matrix exponential: computes exp(-tL) as a matrix,
 * then applies it to a probe vector. Uses 12 Taylor terms with scaling
 * to keep the norm small for convergence.
 */
function buildExpMinusTL(L: number[][], t: number, maxTerms: number = 12): number[][] {
  const n = L.length;
  const normL = matFrobeniusNorm(L);
  const s = Math.max(0, Math.ceil(Math.log2(Math.max(1, normL * t))));
  const tScaled = t / Math.pow(2, s);

  let result = identityMatrix(n);
  let termMat = identityMatrix(n);
  let factorial = 1;

  const negTL: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => -tScaled * L[i][j]),
  );

  for (let k = 1; k <= maxTerms; k++) {
    factorial *= k;
    termMat = matMul(negTL, termMat);
    const coeff = 1 / factorial;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) result[i][j] += coeff * termMat[i][j];
  }

  for (let sq = 0; sq < s; sq++) {
    result = matMul(result, result);
  }

  return result;
}

function hutchinsonTrace(L: number[][], t: number, k: number = 16): number {
  const n = L.length;
  const expMat = buildExpMinusTL(L, t, 12);
  let traceEstimate = 0;
  for (let probe = 0; probe < k; probe++) {
    const z = new Array(n).fill(0).map(() => (Math.random() < 0.5 ? -1 : 1));
    const expLz = matVecFromMat(expMat, z);
    let d = 0;
    for (let i = 0; i < n; i++) d += z[i] * expLz[i];
    traceEstimate += d;
  }
  return traceEstimate / k;
}

export function computeHeatTraceComplexity(graph: SignedGraph): number {
  if (graph.n <= 1 || graph.edges.length === 0) return 0.5;
  const { L } = buildSignedLaplacian(graph.n, graph.edges);
  const trace1 = hutchinsonTrace(L, 0.5, 16);
  const trace2 = hutchinsonTrace(L, 1.0, 16);
  const normalized = (trace1 + trace2) / (2 * graph.n);
  return clamp01((normalized - 0.5) / 1.5);
}
