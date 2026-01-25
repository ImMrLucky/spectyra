import type { SemanticUnit, GraphEdge, SpectralOptions, PathKind } from "../spectral/types";
import { cosine } from "../spectral/math";

export function buildSimilarityEdges(units: SemanticUnit[], opts: SpectralOptions, path: PathKind): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const n = units.length;

  // Path-based weighting: code similarity edges slightly stronger for code/code units
  const baseW = path === "code" ? 1.0 : 0.8;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const sim = cosine(units[i].embedding, units[j].embedding);
      if (sim >= opts.similarityEdgeMin) {
        let w = baseW * sim;

        // If both are code/patch in code path, boost slightly
        if (path === "code") {
          const ki = units[i].kind, kj = units[j].kind;
          if ((ki === "code" || ki === "patch") && (kj === "code" || kj === "patch")) {
            w = Math.min(1.2, w + 0.15);
          }
        }

        edges.push({ i, j, w, type: "similarity" });
      }
    }
  }
  return edges;
}
