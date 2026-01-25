export type PathKind = "talk" | "code";

export type SemanticUnitKind = "fact" | "constraint" | "explanation" | "code" | "patch";

export interface SemanticUnit {
  id: string;
  kind: SemanticUnitKind;
  text: string;
  embedding?: number[];
  stabilityScore: number; // [0,1]
  createdAtTurn: number;
}

export interface GraphEdge {
  i: number;          // source node index
  j: number;          // target node index
  w: number;          // signed weight (+ support/similarity, - contradiction)
  type: "similarity" | "contradiction" | "dependency";
}

export interface SignedGraph {
  n: number;
  edges: GraphEdge[];
}

export interface SpectralOptions {
  // thresholds for recommendation
  tLow: number;     // stabilityIndex <= tLow => ASK_CLARIFY / EXPAND_UNSTABLE
  tHigh: number;    // stabilityIndex >= tHigh => REUSE / COLLAPSE
  // controls
  maxNodes: number;            // e.g. 50
  similarityEdgeMin: number;   // e.g. 0.85
  contradictionEdgeWeight: number; // e.g. -0.8
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
  // Internal operator signals (stored in debug_internal_json, not public API)
  _internal?: {
    rwGap?: number;
    heatComplexity?: number;
    curvature?: { min: number; p10: number; avg: number };
    noveltyAvg?: number;
    stabilityComponents?: any;
    edgeCountsByType?: { similarity: number; contradiction: number; dependency: number };
  };
}
