import type { SignedGraph, SpectralOptions, SpectralResult } from "./types";
import { buildSignedLaplacian } from "./signedLaplacian";
import { computeCombinedStabilityIndex, computeStabilityIndexV2 } from "./stabilityIndex";
import { estimateLambda2 } from "./powerIteration";
import { computeRandomWalkGap } from "./randomWalk";
import { computeHeatTraceComplexity } from "./heatTrace";
import { computeCurvatureStats } from "./curvature";
import type { SemanticUnit } from "./types";
import { computeNodeFeatures, getAverageNovelty } from "./nodeFeatures";

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
  contradictionTrend?: 'increasing' | 'decreasing' | 'stable';
}

export interface SpectralAnalyzeInput {
  graph: SignedGraph;
  opts: SpectralOptions;
  units?: SemanticUnit[]; // For node features
  currentTurn?: number; // For node features
  conversationMetrics?: ConversationMetrics; // NEW: For adaptive thresholds
}

export function spectralAnalyze(
  graphOrInput: SignedGraph | SpectralAnalyzeInput,
  opts?: SpectralOptions,
  units?: SemanticUnit[],
  currentTurn?: number
): SpectralResult {
  // Handle both new and legacy signatures
  let graph: SignedGraph;
  let spectralOpts: SpectralOptions;
  let unitsList: SemanticUnit[] | undefined;
  let turn: number | undefined;

  if ("graph" in graphOrInput) {
    // New signature: { graph, opts, units?, currentTurn? }
    graph = graphOrInput.graph;
    spectralOpts = graphOrInput.opts;
    unitsList = graphOrInput.units;
    turn = graphOrInput.currentTurn;
  } else {
    // Legacy signature: (graph, opts, units?, currentTurn?)
    graph = graphOrInput as SignedGraph;
    spectralOpts = opts!;
    unitsList = units;
    turn = currentTurn;
  }

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

  // NEW: Calculate graph metrics for enhanced stability and confidence
  const maxEdges = (n * (n - 1)) / 2;
  const graphDensity = maxEdges > 0 ? nEdges / maxEdges : 0;
  const posEdges = graph.edges.filter(e => e.w > 0);
  const avgSimilarity = posEdges.length > 0 
    ? posEdges.reduce((sum, e) => sum + e.w, 0) / posEdges.length 
    : 0;

  // Compute additional operators
  const rwGap = computeRandomWalkGap(graph);
  const heatComplexity = computeHeatTraceComplexity(graph);
  const curvature = computeCurvatureStats(graph);

  // Compute node features if units provided
  let noveltyAvg = 0.5; // Default
  if (unitsList && turn !== undefined) {
    const features = computeNodeFeatures(unitsList, turn);
    noveltyAvg = getAverageNovelty(features, 5);
  }

  // Compute combined stability (multi-operator)
  const stability = computeCombinedStabilityIndex(
    lambda2,
    cEnergy,
    rwGap,
    heatComplexity,
    curvature.curvatureMin,
    curvature.curvatureAvg,
    noveltyAvg
  );

  const stabilityFinal = stability.stabilityFinal;

  // NEW: Adaptive thresholds based on conversation history
  let tHigh = spectralOpts.tHigh;
  let tLow = spectralOpts.tLow;
  
  // Extract conversationMetrics from input if available
  const conversationMetrics = ("conversationMetrics" in (graphOrInput as any)) 
    ? (graphOrInput as SpectralAnalyzeInput).conversationMetrics 
    : undefined;
  
  if (conversationMetrics) {
    // If conversation has been unstable, be more conservative
    if (conversationMetrics.avgStabilityPast5Turns !== undefined && 
        conversationMetrics.avgStabilityPast5Turns < 0.5) {
      tHigh += 0.05; // Require higher stability for REUSE
      tLow += 0.03;
    }
    
    // If contradictions are increasing, be more cautious
    if (conversationMetrics.contradictionTrend === 'increasing') {
      tHigh += 0.08;
    }
  }

  // Updated decision thresholds with adaptive values
  // ASK_CLARIFY if stabilityFinal <= tLow OR contradictionEnergy high OR curvatureMin very low
  // EXPAND if tLow < stabilityFinal < tHigh
  // REUSE if >= tHigh
  const recommendation =
    stabilityFinal >= tHigh ? "REUSE" :
    (stabilityFinal <= tLow || cEnergy > 0.3 || curvature.curvatureMin < -3) ? "ASK_CLARIFY" :
    "EXPAND";

  // NEW: Compute confidence score using graph structure quality
  const confidence = Math.min(1, 
    (graphDensity * 0.4) + 
    (avgSimilarity * 0.3) + 
    ((1 - cEnergy) * 0.3)
  );

  // Improved stable/unstable selection
  const unstable: number[] = [];
  const stable: number[] = [];

  // Get node features for better selection
  let features: Array<{ novelty: number }> = [];
  if (unitsList && turn !== undefined) {
    features = computeNodeFeatures(unitsList, turn);
  }

  for (let i = 0; i < n; i++) {
    let hasStrongNeg = false;
    let negCount = 0;
    
    for (let j = 0; j < n; j++) {
      if (W[i][j] < -0.5) {
        hasStrongNeg = true;
        negCount++;
      }
    }

    const novelty = features[i]?.novelty ?? 0.5;
    const curvatureLocal = computeNodeCurvatureLocal(i, W, n, curvature);

    // Unstable if:
    // - high contradiction adjacency OR
    // - very low curvature OR
    // - high novelty
    const isUnstable =
      hasStrongNeg ||
      negCount >= 2 ||
      curvatureLocal < -2 ||
      novelty > 0.7 ||
      Math.abs(v[i]) > 0.4;

    if (isUnstable) {
      unstable.push(i);
    } else {
      // Stable if:
      // - high similarity cluster membership AND
      // - low novelty AND
      // - low contradiction adjacency
      const isStable =
        !hasStrongNeg &&
        novelty < 0.4 &&
        curvatureLocal > -1 &&
        Math.abs(v[i]) < 0.3;

      if (isStable) {
        stable.push(i);
      } else {
        // Ambiguous: default to unstable for safety
        unstable.push(i);
      }
    }
  }

  // Count edges by type for debug
  const edgeCountsByType = {
    similarity: graph.edges.filter(e => e.type === "similarity").length,
    contradiction: graph.edges.filter(e => e.type === "contradiction").length,
    dependency: graph.edges.filter(e => e.type === "dependency").length,
  };

  return {
    nNodes: n,
    nEdges,
    lambda2,
    contradictionEnergy: cEnergy,
    stabilityIndex: stabilityFinal,
    recommendation,
    stableNodeIdx: stable,
    unstableNodeIdx: unstable,
    // Internal signals (only in debug_internal_json, never in public API)
    _internal: {
      rwGap,
      heatComplexity,
      curvature: {
        min: curvature.curvatureMin,
        p10: curvature.curvatureP10,
        avg: curvature.curvatureAvg,
      },
      noveltyAvg,
      stabilityComponents: stability.components,
      edgeCountsByType,
      // NEW: Graph metrics and adaptive thresholds
      graphDensity,
      avgSimilarity,
      confidence,
      adaptiveThresholds: { tHigh, tLow },
    },
  };
}

/**
 * Compute local curvature for a node (simplified)
 */
function computeNodeCurvatureLocal(
  nodeIdx: number,
  W: number[][],
  n: number,
  globalCurvature: { curvatureMin: number; curvatureAvg: number }
): number {
  // Simplified: use degree and negative edge count
  let degree = 0;
  let negEdges = 0;
  
  for (let j = 0; j < n; j++) {
    if (j !== nodeIdx && W[nodeIdx][j] !== 0) {
      degree++;
      if (W[nodeIdx][j] < 0) negEdges++;
    }
  }
  
  // Rough curvature estimate
  return degree - negEdges * 2;
}
