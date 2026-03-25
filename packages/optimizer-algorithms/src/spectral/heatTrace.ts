import type { SignedGraph } from "../types.js";
import { buildSignedLaplacian } from "./signedLaplacian.js";
import { matVec } from "./powerIteration.js";
import { clamp01 } from "../math.js";

function approximateExpMinusTL(L: number[][], z: number[], t: number, maxTerms: number = 4): number[] {
  const n = L.length;
  let result = [...z];
  let term = [...z];
  let factorial = 1;
  for (let k = 1; k <= maxTerms; k++) {
    factorial *= k;
    const sign = k % 2 === 0 ? 1 : -1;
    term = matVec(L, term);
    const coeff = (sign * Math.pow(t, k)) / factorial;
    for (let i = 0; i < n; i++) result[i] += coeff * term[i];
  }
  return result;
}

function hutchinsonTrace(L: number[][], t: number, k: number = 8): number {
  const n = L.length;
  let traceEstimate = 0;
  for (let probe = 0; probe < k; probe++) {
    const z = new Array(n).fill(0).map(() => (Math.random() < 0.5 ? -1 : 1));
    const expLz = approximateExpMinusTL(L, z, t, 4);
    let d = 0;
    for (let i = 0; i < n; i++) d += z[i] * expLz[i];
    traceEstimate += d;
  }
  return traceEstimate / k;
}

export function computeHeatTraceComplexity(graph: SignedGraph): number {
  if (graph.n <= 1 || graph.edges.length === 0) return 0.5;
  const { L } = buildSignedLaplacian(graph.n, graph.edges);
  const trace1 = hutchinsonTrace(L, 0.5, 8);
  const trace2 = hutchinsonTrace(L, 1.0, 8);
  const normalized = (trace1 + trace2) / (2 * graph.n);
  return clamp01((normalized - 0.5) / 1.5);
}
