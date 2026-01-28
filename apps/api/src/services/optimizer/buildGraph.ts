import type { SemanticUnit, SignedGraph, GraphEdge, SpectralOptions, PathKind } from "./spectral/types";
import { buildSimilarityEdges } from "./edgeBuilders/similarityEdges";
import { buildContradictionEdges, buildContradictionEdgesWithNli } from "./edgeBuilders/contradictionEdges";
import { buildDependencyEdges } from "./edgeBuilders/dependencyEdges";
import { config } from "../../config.js";

export interface BuildGraphInput {
  path: PathKind;
  units: SemanticUnit[];
  opts: SpectralOptions;
}

/**
 * Build semantic graph synchronously (uses heuristic contradiction detection)
 * This is the fast path that doesn't require NLI
 */
export function buildGraph(input: BuildGraphInput): SignedGraph {
  const units = input.units.slice(-input.opts.maxNodes);
  const n = units.length;
  const edges: GraphEdge[] = [];

  edges.push(...buildSimilarityEdges(units, input.opts, input.path));
  edges.push(...buildContradictionEdges(units, input.opts, input.path));
  edges.push(...buildDependencyEdges(units, input.path));

  // Ensure no out-of-range edges
  const filtered = edges.filter(e => e.i >= 0 && e.j >= 0 && e.i < n && e.j < n && e.i !== e.j);

  return { n, edges: filtered };
}

/**
 * Build semantic graph asynchronously with optional NLI enhancement
 * Uses MNLI model for more accurate contradiction detection when available
 */
export async function buildGraphAsync(input: BuildGraphInput): Promise<SignedGraph> {
  const units = input.units.slice(-input.opts.maxNodes);
  const n = units.length;
  const edges: GraphEdge[] = [];

  // Similarity and dependency edges (synchronous)
  edges.push(...buildSimilarityEdges(units, input.opts, input.path));
  edges.push(...buildDependencyEdges(units, input.path));
  
  // Contradiction edges with optional NLI (async)
  if (config.nli.provider !== "disabled") {
    const contradictionEdges = await buildContradictionEdgesWithNli(units, input.opts, input.path);
    edges.push(...contradictionEdges);
  } else {
    edges.push(...buildContradictionEdges(units, input.opts, input.path));
  }

  // Ensure no out-of-range edges
  const filtered = edges.filter(e => e.i >= 0 && e.j >= 0 && e.i < n && e.j < n && e.i !== e.j);

  return { n, edges: filtered };
}
