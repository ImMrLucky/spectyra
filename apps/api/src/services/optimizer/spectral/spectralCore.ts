import type { SignedGraph, SpectralOptions, SpectralResult } from "./types";
import { buildSignedLaplacian } from "./signedLaplacian";
import { computeStabilityIndex } from "./stabilityIndex";
import { estimateLambda2 } from "./powerIteration";

export function contradictionEnergy(graph: SignedGraph): number {
  let neg = 0;
  let total = 0;
  for (const e of graph.edges) {
    const aw = Math.abs(e.w);
    total += aw;
    if (e.w < 0) neg += aw;
  }
  return total === 0 ? 0 : neg / total;
}

export function spectralAnalyze(graph: SignedGraph, opts: SpectralOptions): SpectralResult {
  const n = graph.n;
  const nEdges = graph.edges.length;

  if (n <= 1 || nEdges === 0) {
    return {
      nNodes: n,
      nEdges,
      lambda2: 0,
      contradictionEnergy: 0,
      stabilityIndex: 0.5,
      recommendation: "EXPAND",
      stableNodeIdx: [],
      unstableNodeIdx: []
    };
  }

  const { L, W } = buildSignedLaplacian(n, graph.edges);
  const { lambda2, v } = estimateLambda2(L);

  const cEnergy = contradictionEnergy(graph);
  const sIndex = computeStabilityIndex(lambda2, cEnergy);

  const recommendation =
    sIndex >= opts.tHigh ? "REUSE" :
    sIndex <= opts.tLow ? "ASK_CLARIFY" :
    "EXPAND";

  // Identify stable vs unstable nodes by contradiction adjacency & eigenvector magnitude
  const unstable: number[] = [];
  const stable: number[] = [];
  for (let i = 0; i < n; i++) {
    let hasStrongNeg = false;
    for (let j = 0; j < n; j++) {
      if (W[i][j] < -0.5) { hasStrongNeg = true; break; }
    }
    // heuristic: nodes with strong contradiction or high |v_i| are "unstable focus"
    if (hasStrongNeg || Math.abs(v[i]) > 0.35) unstable.push(i);
    else stable.push(i);
  }

  return {
    nNodes: n,
    nEdges,
    lambda2,
    contradictionEnergy: cEnergy,
    stabilityIndex: sIndex,
    recommendation,
    stableNodeIdx: stable,
    unstableNodeIdx: unstable
  };
}
