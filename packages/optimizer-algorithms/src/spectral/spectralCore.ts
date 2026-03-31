import type { SignedGraph, SpectralOptions, SpectralResult, SemanticUnit } from "../types.js";
import { buildSignedLaplacian } from "./signedLaplacian.js";
import { computeCombinedStabilityIndex } from "./stabilityIndex.js";
import { estimateLambda2 } from "./powerIteration.js";
import { computeRandomWalkGap } from "./randomWalk.js";
import { computeHeatTraceComplexity } from "./heatTrace.js";
import { computeCurvatureStats } from "./curvature.js";
import { computeNodeFeatures, getAverageNovelty } from "./nodeFeatures.js";

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

export interface ConversationMetrics {
  avgStabilityPast5Turns?: number;
  contradictionTrend?: "increasing" | "decreasing" | "stable";
}

export interface SpectralAnalyzeInput {
  graph: SignedGraph;
  opts: SpectralOptions;
  units?: SemanticUnit[];
  currentTurn?: number;
  conversationMetrics?: ConversationMetrics;
}

export function spectralAnalyze(
  graphOrInput: SignedGraph | SpectralAnalyzeInput,
  opts?: SpectralOptions,
  units?: SemanticUnit[],
  currentTurn?: number
): SpectralResult {
  let graph: SignedGraph;
  let spectralOpts: SpectralOptions;
  let unitsList: SemanticUnit[] | undefined;
  let turn: number | undefined;

  if ("graph" in graphOrInput) {
    graph = graphOrInput.graph;
    spectralOpts = graphOrInput.opts;
    unitsList = graphOrInput.units;
    turn = graphOrInput.currentTurn;
  } else {
    graph = graphOrInput as SignedGraph;
    spectralOpts = opts!;
    unitsList = units;
    turn = currentTurn;
  }

  const n = graph.n;
  const nEdges = graph.edges.length;

  if (n <= 1 || nEdges === 0) {
    return {
      nNodes: n, nEdges, lambda2: 0, contradictionEnergy: 0, stabilityIndex: 0.5,
      recommendation: "EXPAND", stableNodeIdx: [], unstableNodeIdx: [],
    };
  }

  const { L, W } = buildSignedLaplacian(n, graph.edges);
  const { lambda2, v } = estimateLambda2(L);
  const cEnergy = contradictionEnergy(graph);

  const maxEdges = (n * (n - 1)) / 2;
  const graphDensity = maxEdges > 0 ? nEdges / maxEdges : 0;
  const posEdges = graph.edges.filter(e => e.w > 0);
  const avgSimilarity = posEdges.length > 0
    ? posEdges.reduce((sum, e) => sum + e.w, 0) / posEdges.length
    : 0;

  const rwGap = computeRandomWalkGap(graph);
  const heatComplexity = computeHeatTraceComplexity(graph);
  const curvature = computeCurvatureStats(graph);

  let noveltyAvg = 0.5;
  if (unitsList && turn !== undefined) {
    const features = computeNodeFeatures(unitsList, turn);
    noveltyAvg = getAverageNovelty(features, 5);
  }

  const stability = computeCombinedStabilityIndex(
    lambda2, cEnergy, rwGap, heatComplexity,
    curvature.curvatureMin, curvature.curvatureAvg, noveltyAvg
  );
  const stabilityFinal = stability.stabilityFinal;

  let tHigh = spectralOpts.tHigh;
  let tLow = spectralOpts.tLow;
  const conversationMetrics = ("conversationMetrics" in (graphOrInput as any))
    ? (graphOrInput as SpectralAnalyzeInput).conversationMetrics
    : undefined;
  if (conversationMetrics) {
    if (conversationMetrics.avgStabilityPast5Turns !== undefined &&
      conversationMetrics.avgStabilityPast5Turns < 0.5) {
      tHigh += 0.05;
      tLow += 0.03;
    }
    if (conversationMetrics.contradictionTrend === "increasing") {
      tHigh += 0.08;
    }
  }

  const recommendation =
    stabilityFinal >= tHigh ? "REUSE" :
      (stabilityFinal <= tLow || cEnergy > 0.3 || curvature.curvatureMin < -3) ? "ASK_CLARIFY" :
        "EXPAND";

  const confidence = Math.min(1,
    (graphDensity * 0.4) + (avgSimilarity * 0.3) + ((1 - cEnergy) * 0.3)
  );

  const unstable: number[] = [];
  const stable: number[] = [];
  let features: Array<{ novelty: number }> = [];
  if (unitsList && turn !== undefined) {
    features = computeNodeFeatures(unitsList, turn);
  }

  for (let i = 0; i < n; i++) {
    let hasStrongNeg = false;
    let negCount = 0;
    for (let j = 0; j < n; j++) {
      if (W[i][j] < -0.5) { hasStrongNeg = true; negCount++; }
    }
    const novelty = features[i]?.novelty ?? 0.5;
    const curvLocal = computeNodeCurvatureLocal(i, W, n);
    const isUnstable = hasStrongNeg || negCount >= 2 || curvLocal < -2 || novelty > 0.7 || Math.abs(v[i]) > 0.4;
    if (isUnstable) {
      unstable.push(i);
    } else {
      const isStable = !hasStrongNeg && novelty < 0.4 && curvLocal > -1 && Math.abs(v[i]) < 0.3;
      if (isStable) stable.push(i);
      else unstable.push(i);
    }
  }

  const edgeCountsByType = {
    similarity: graph.edges.filter(e => e.type === "similarity").length,
    contradiction: graph.edges.filter(e => e.type === "contradiction").length,
    dependency: graph.edges.filter(e => e.type === "dependency").length,
  };

  return {
    nNodes: n, nEdges, lambda2, contradictionEnergy: cEnergy,
    stabilityIndex: stabilityFinal, recommendation,
    stableNodeIdx: stable, unstableNodeIdx: unstable,
    _internal: {
      rwGap, heatComplexity,
      curvature: { min: curvature.curvatureMin, p10: curvature.curvatureP10, avg: curvature.curvatureAvg },
      noveltyAvg, stabilityComponents: stability.components, edgeCountsByType,
      graphDensity, avgSimilarity, confidence,
      adaptiveThresholds: { tHigh, tLow },
    },
  };
}

function computeNodeCurvatureLocal(nodeIdx: number, W: number[][], n: number): number {
  let degree = 0;
  let edgeSum = 0;
  const neighbors: number[] = [];
  for (let j = 0; j < n; j++) {
    if (j !== nodeIdx && W[nodeIdx][j] !== 0) {
      degree++;
      edgeSum += Math.abs(W[nodeIdx][j]);
      neighbors.push(j);
    }
  }
  let commonNeighborPenalty = 0;
  for (const j of neighbors) {
    let common = 0;
    for (const k of neighbors) {
      if (k !== j && W[j][k] !== 0) common++;
    }
    commonNeighborPenalty += common * 0.1;
  }
  return degree - edgeSum - commonNeighborPenalty;
}
