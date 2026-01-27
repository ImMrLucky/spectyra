/**
 * Semantic Hash Caching
 * 
 * Core Moat v1: Increase cache hit rates by hashing semantic graphs, not raw text
 * Similar prompts with different wording should hit the same cache key
 */

import { SemanticUnit } from "../spectral/types";
import { SpectralResult } from "../spectral/types";
import { createHash } from "node:crypto";

export interface SemanticHashInput {
  units: SemanticUnit[];
  spectral: SpectralResult;
  routeMeta?: {
    model?: string;
    path?: string;
  };
}

/**
 * Compute semantic cache key from:
 * - Unit embeddings/IDs
 * - Refpack selection (stable nodes)
 * - Top-k stable nodes
 * - Route decision (model tier)
 */
export function semanticCacheKey(input: SemanticHashInput): string {
  const { units, spectral, routeMeta } = input;

  // Get stable unit IDs (top-k by stability)
  const stableUnitIds = spectral.stableNodeIdx
    .slice(0, 10) // Top 10 stable units
    .map(idx => units[idx]?.id)
    .filter(Boolean)
    .sort();

  // Get unit embeddings (if available) - use first few dimensions for hashing
  const embeddingHashes = units
    .filter(u => u.embedding && u.embedding.length > 0)
    .slice(0, 20) // Top 20 units
    .map(u => {
      // Hash first 8 dimensions of embedding
      const dims = u.embedding!.slice(0, 8);
      return dims.map(d => Math.round(d * 1000) / 1000).join(",");
    })
    .join("|");

  // Build hash components
  const components = [
    stableUnitIds.join(","),
    embeddingHashes,
    routeMeta?.model || "",
    routeMeta?.path || "",
    spectral.stabilityIndex.toFixed(3),
    spectral.lambda2?.toFixed(3) || "",
  ];

  const combined = components.join("::");

  // Create hash
  const hash = createHash("sha256").update(combined).digest("hex");

  return `semantic_${hash.substring(0, 16)}`;
}

/**
 * Check if cache key is semantic (vs raw text)
 */
export function isSemanticCacheKey(key: string): boolean {
  return key.startsWith("semantic_");
}
