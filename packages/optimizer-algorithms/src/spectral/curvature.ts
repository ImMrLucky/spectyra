import type { SignedGraph } from "../types.js";
import { buildSignedAdjacency } from "./signedLaplacian.js";

export interface CurvatureStats {
  curvatureMin: number;
  curvatureP10: number;
  curvatureAvg: number;
}

function buildAdjacencyLists(W: number[][], n: number): Map<number, Set<number>> {
  const adj = new Map<number, Set<number>>();
  for (let i = 0; i < n; i++) adj.set(i, new Set());
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (W[i][j] !== 0) {
        adj.get(i)!.add(j);
        adj.get(j)!.add(i);
      }
  return adj;
}

function computeNodeCurvature(nodeIdx: number, W: number[][], adj: Map<number, Set<number>>): number {
  const neighbors = adj.get(nodeIdx)!;
  let degree = 0;
  let edgeSum = 0;
  let commonNeighborPenalty = 0;

  for (const j of neighbors) {
    degree++;
    edgeSum += Math.abs(W[nodeIdx][j]);
    const jNeighbors = adj.get(j)!;
    let commonNeighbors = 0;
    for (const k of neighbors) {
      if (k !== j && jNeighbors.has(k)) commonNeighbors++;
    }
    commonNeighborPenalty += commonNeighbors * 0.1;
  }

  return degree - edgeSum - commonNeighborPenalty;
}

export function computeCurvatureStats(graph: SignedGraph): CurvatureStats {
  if (graph.n <= 1) return { curvatureMin: 0, curvatureP10: 0, curvatureAvg: 0 };
  const W = buildSignedAdjacency(graph.n, graph.edges);
  const adj = buildAdjacencyLists(W, graph.n);
  const curvatures: number[] = [];
  for (let i = 0; i < graph.n; i++) curvatures.push(computeNodeCurvature(i, W, adj));
  const sorted = [...curvatures].sort((a, b) => a - b);
  const min = sorted[0];
  const p10Idx = Math.floor(sorted.length * 0.1);
  const p10 = sorted[p10Idx];
  const avg = curvatures.reduce((sum, c) => sum + c, 0) / curvatures.length;
  return { curvatureMin: min, curvatureP10: p10, curvatureAvg: avg };
}
