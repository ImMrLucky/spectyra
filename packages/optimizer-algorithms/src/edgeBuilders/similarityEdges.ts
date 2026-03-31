import type { SemanticUnit, GraphEdge, SpectralOptions, PathKind } from "../types.js";
import { cosine } from "../math.js";

function temporalProximityBoost(unitI: SemanticUnit, unitJ: SemanticUnit): number {
  const turnDiff = Math.abs(unitI.createdAtTurn - unitJ.createdAtTurn);
  if (turnDiff === 0) return 0.15;
  if (turnDiff === 1) return 0.08;
  if (turnDiff <= 3) return 0.03;
  return 0;
}

function kindSimilarityBoost(unitI: SemanticUnit, unitJ: SemanticUnit): number {
  if (unitI.kind === unitJ.kind) {
    if (unitI.kind === "constraint") return 0.12;
    if (unitI.kind === "fact") return 0.08;
    if (unitI.kind === "explanation") return 0.05;
  }
  return 0;
}

export function buildSimilarityEdges(units: SemanticUnit[], opts: SpectralOptions, path: PathKind): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const n = units.length;
  const baseW = path === "code" ? 1.0 : 0.8;
  for (let i = 0; i < n; i++) {
    if (!units[i].embedding || units[i].embedding!.length === 0) continue;
    for (let j = i + 1; j < n; j++) {
      if (!units[j].embedding || units[j].embedding!.length === 0) continue;
      const sim = cosine(units[i].embedding!, units[j].embedding!);
      if (sim >= opts.similarityEdgeMin) {
        let w = baseW * sim;
        if (path === "code") {
          const ki = units[i].kind, kj = units[j].kind;
          if ((ki === "code" || ki === "patch") && (kj === "code" || kj === "patch")) {
            w = Math.min(1.2, w + 0.15);
          }
        }
        w += temporalProximityBoost(units[i], units[j]);
        w += kindSimilarityBoost(units[i], units[j]);
        w = Math.min(1.5, w);
        edges.push({ i, j, w, type: "similarity" });
      }
    }
  }
  return edges;
}
