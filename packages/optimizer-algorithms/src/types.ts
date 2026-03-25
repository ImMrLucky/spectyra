/**
 * Core algorithm types.
 * These are the internal types used by the optimization algorithms.
 * They do NOT reference vendor or tool names.
 */

export type PathKind = "talk" | "code";
export type SemanticUnitKind = "fact" | "constraint" | "explanation" | "code" | "patch";

export interface SemanticUnit {
  id: string;
  kind: SemanticUnitKind;
  text: string;
  embedding?: number[];
  stabilityScore: number;
  createdAtTurn: number;
}

export interface GraphEdge {
  i: number;
  j: number;
  w: number;
  type: "similarity" | "contradiction" | "dependency";
}

export interface SignedGraph {
  n: number;
  edges: GraphEdge[];
}

export interface SpectralOptions {
  tLow: number;
  tHigh: number;
  maxNodes: number;
  similarityEdgeMin: number;
  contradictionEdgeWeight: number;
}

export interface SpectralResult {
  nNodes: number;
  nEdges: number;
  lambda2: number;
  contradictionEnergy: number;
  stabilityIndex: number;
  recommendation: "REUSE" | "EXPAND" | "ASK_CLARIFY";
  stableNodeIdx: number[];
  unstableNodeIdx: number[];
  _internal?: {
    rwGap?: number;
    heatComplexity?: number;
    curvature?: { min: number; p10: number; avg: number };
    noveltyAvg?: number;
    stabilityComponents?: unknown;
    edgeCountsByType?: { similarity: number; contradiction: number; dependency: number };
    graphDensity?: number;
    avgSimilarity?: number;
    confidence?: number;
    adaptiveThresholds?: { tHigh: number; tLow: number };
  };
}

export interface Budgets {
  keepLastTurns: number;
  maxRefpackEntries: number;
  minRefpackSavings: number;
  compressionAggressiveness: number;
  phrasebookAggressiveness: number;
  codemapDetailLevel: number;
  stateCompressionLevel: number;
  maxStateChars: number;
  retainToolLogs: boolean;
}

export interface ProfitGateOptions {
  minPctGain: number;
  minAbsGain: number;
}

export interface ProfitGateResult {
  useAfter: boolean;
  before: number;
  after: number;
  pct: number;
  absChange: number;
  label: string;
}

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface TextSegment {
  type: "code" | "text";
  content: string;
  lang?: string;
}
