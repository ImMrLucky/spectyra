import type { SignedGraph } from "../types.js";
import { buildSignedAdjacency } from "./signedLaplacian.js";

export interface CurvatureStats {
  curvatureMin: number;
  curvatureP10: number;
  curvatureAvg: number;
}

function computeNodeCurvature(nodeIdx: number, W: number[][], n: number): number {
  let degree = 0;
  let edgeSum = 0;
  let commonNeighborPenalty = 0;
  for (let j = 0; j < n; j++) {
    if (j !== nodeIdx && W[nodeIdx][j] !== 0) {
      degree++;
      edgeSum += Math.abs(W[nodeIdx][j]);
      let commonNeighbors = 0;
      for (let k = 0; k < n; k++) {
        if (k !== nodeIdx && k !== j && W[nodeIdx][k] !== 0 && W[j][k] !== 0) commonNeighbors++;
      }
      commonNeighborPenalty += commonNeighbors * 0.1;
    }
  }
  return degree - edgeSum - commonNeighborPenalty;
}

export function computeCurvatureStats(graph: SignedGraph): CurvatureStats {
  if (graph.n <= 1) return { curvatureMin: 0, curvatureP10: 0, curvatureAvg: 0 };
  const W = buildSignedAdjacency(graph.n, graph.edges);
  const curvatures: number[] = [];
  for (let i = 0; i < graph.n; i++) curvatures.push(computeNodeCurvature(i, W, graph.n));
  const sorted = [...curvatures].sort((a, b) => a - b);
  const min = sorted[0];
  const p10Idx = Math.floor(sorted.length * 0.1);
  const p10 = sorted[p10Idx];
  const avg = curvatures.reduce((sum, c) => sum + c, 0) / curvatures.length;
  return { curvatureMin: min, curvatureP10: p10, curvatureAvg: avg };
}
