/**
 * Node Features - Internal features for semantic units
 * 
 * Computes novelty, age, kind weight for each unit.
 * Used internally for stability scoring and selection.
 */

import type { SemanticUnit } from "./types.js";
import { cosine } from "./math.js";

export interface NodeFeatures {
  ageTurns: number; // currentTurn - unit.createdAtTurn
  length: number; // unit.text.length
  kindWeight: number; // weight based on unit kind
  novelty: number; // 0-1, higher = more novel (different from recent units)
}

/**
 * Kind weight mapping
 */
function getKindWeight(kind: SemanticUnit["kind"]): number {
  const weights: Record<SemanticUnit["kind"], number> = {
    constraint: 1.2,
    fact: 1.0,
    explanation: 0.8,
    code: 1.1,
    patch: 1.3,
  };
  return weights[kind] || 1.0;
}

/**
 * Compute centroid embedding of recent units
 */
function computeCentroid(units: SemanticUnit[], recentCount: number = 10): number[] | null {
  const recent = units.slice(-recentCount).filter(u => u.embedding && u.embedding.length > 0);
  if (recent.length === 0) return null;

  const dim = recent[0].embedding!.length;
  const centroid = new Array(dim).fill(0);

  for (const unit of recent) {
    if (unit.embedding && unit.embedding.length === dim) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += unit.embedding[i];
      }
    }
  }

  // Normalize
  for (let i = 0; i < dim; i++) {
    centroid[i] /= recent.length;
  }

  return centroid;
}

/**
 * Compute novelty score for a unit
 * novelty = 1 - cosine(unitEmbedding, centroid)
 * Higher novelty = more different from recent context
 */
function computeNovelty(
  unit: SemanticUnit,
  centroid: number[] | null
): number {
  if (!unit.embedding || !centroid || unit.embedding.length !== centroid.length) {
    return 0.5; // Default to medium novelty if can't compute
  }

  const sim = cosine(unit.embedding, centroid);
  return 1 - Math.max(0, sim); // Clamp to [0, 1]
}

/**
 * Compute node features for all units
 */
export function computeNodeFeatures(
  units: SemanticUnit[],
  currentTurn: number
): NodeFeatures[] {
  // Compute centroid of recent units (for novelty)
  const centroid = computeCentroid(units, Math.min(10, units.length));

  return units.map(unit => {
    const ageTurns = currentTurn - unit.createdAtTurn;
    const length = unit.text.length;
    const kindWeight = getKindWeight(unit.kind);
    const novelty = computeNovelty(unit, centroid);

    return {
      ageTurns,
      length,
      kindWeight,
      novelty,
    };
  });
}

/**
 * Get average novelty of recent units
 */
export function getAverageNovelty(features: NodeFeatures[], recentCount: number = 5): number {
  const recent = features.slice(-recentCount);
  if (recent.length === 0) return 0.5;
  const sum = recent.reduce((acc, f) => acc + f.novelty, 0);
  return sum / recent.length;
}
