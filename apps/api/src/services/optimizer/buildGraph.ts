import type { SemanticUnit, SignedGraph, GraphEdge, SpectralOptions, PathKind } from "./spectral/types";
import { buildSimilarityEdges } from "./edgeBuilders/similarityEdges";
import { buildContradictionEdges } from "./edgeBuilders/contradictionEdges";

export interface BuildGraphInput {
  path: PathKind;
  units: SemanticUnit[];
  opts: SpectralOptions;
}

export function buildGraph(input: BuildGraphInput): SignedGraph {
  const units = input.units.slice(-input.opts.maxNodes);
  const n = units.length;
  const edges: GraphEdge[] = [];

  edges.push(...buildSimilarityEdges(units, input.opts, input.path));
  edges.push(...buildContradictionEdges(units, input.opts, input.path));

  // Ensure no out-of-range edges
  const filtered = edges.filter(e => e.i >= 0 && e.j >= 0 && e.i < n && e.j < n && e.i !== e.j);

  return { n, edges: filtered };
}
