import type { SemanticUnit, GraphEdge, SpectralOptions, PathKind } from "../spectral/types";
import { cosine } from "../spectral/math";

// NEW: Boost similarity for units from same turn or adjacent turns
function temporalProximityBoost(unitI: SemanticUnit, unitJ: SemanticUnit): number {
  const turnDiff = Math.abs(unitI.createdAtTurn - unitJ.createdAtTurn);
  
  if (turnDiff === 0) return 0.15; // Same turn = very related
  if (turnDiff === 1) return 0.08; // Adjacent turns = related
  if (turnDiff <= 3) return 0.03; // Recent turns = somewhat related
  
  return 0;
}

// NEW: Boost for same semantic kind
function kindSimilarityBoost(unitI: SemanticUnit, unitJ: SemanticUnit): number {
  if (unitI.kind === unitJ.kind) {
    // Same kind = likely related
    if (unitI.kind === "constraint") return 0.12;
    if (unitI.kind === "fact") return 0.08;
    if (unitI.kind === "explanation") return 0.05;
  }
  return 0;
}

export function buildSimilarityEdges(units: SemanticUnit[], opts: SpectralOptions, path: PathKind): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const n = units.length;

  // Path-based weighting: code similarity edges slightly stronger for code/code units
  const baseW = path === "code" ? 1.0 : 0.8;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosine(units[i].embedding, units[j].embedding);
      
      // Only create edge if base similarity meets threshold
      if (sim >= opts.similarityEdgeMin) {
        let w = baseW * sim;

        // Path-specific boosts
        if (path === "code") {
          const ki = units[i].kind, kj = units[j].kind;
          if ((ki === "code" || ki === "patch") && (kj === "code" || kj === "patch")) {
            w = Math.min(1.2, w + 0.15);
          }
        }

        // NEW: Temporal proximity boost
        const temporalBoost = temporalProximityBoost(units[i], units[j]);
        w += temporalBoost;

        // NEW: Kind similarity boost
        const kindBoost = kindSimilarityBoost(units[i], units[j]);
        w += kindBoost;

        // Cap at reasonable maximum
        w = Math.min(1.5, w);

        edges.push({ 
          i, 
          j, 
          w, 
          type: "similarity"
        });
      }
    }
  }
  
  return edges;
}
