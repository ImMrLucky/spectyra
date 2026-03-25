import type { SemanticUnit } from "../types.js";
import { cosine } from "../math.js";

export interface NodeFeatures {
  ageTurns: number;
  length: number;
  kindWeight: number;
  novelty: number;
}

function getKindWeight(kind: SemanticUnit["kind"]): number {
  const weights: Record<SemanticUnit["kind"], number> = {
    constraint: 1.2, fact: 1.0, explanation: 0.8, code: 1.1, patch: 1.3,
  };
  return weights[kind] || 1.0;
}

function computeCentroid(units: SemanticUnit[], recentCount: number = 10): number[] | null {
  const recent = units.slice(-recentCount).filter(u => u.embedding && u.embedding.length > 0);
  if (recent.length === 0) return null;
  const dim = recent[0].embedding!.length;
  const centroid = new Array(dim).fill(0);
  for (const unit of recent) {
    if (unit.embedding && unit.embedding.length === dim) {
      for (let i = 0; i < dim; i++) centroid[i] += unit.embedding[i];
    }
  }
  for (let i = 0; i < dim; i++) centroid[i] /= recent.length;
  return centroid;
}

function computeNovelty(unit: SemanticUnit, centroid: number[] | null): number {
  if (!unit.embedding || !centroid || unit.embedding.length !== centroid.length) return 0.5;
  const sim = cosine(unit.embedding, centroid);
  return 1 - Math.max(0, sim);
}

export function computeNodeFeatures(units: SemanticUnit[], currentTurn: number): NodeFeatures[] {
  const centroid = computeCentroid(units, Math.min(10, units.length));
  return units.map(unit => ({
    ageTurns: currentTurn - unit.createdAtTurn,
    length: unit.text.length,
    kindWeight: getKindWeight(unit.kind),
    novelty: computeNovelty(unit, centroid),
  }));
}

export function getAverageNovelty(features: NodeFeatures[], recentCount: number = 5): number {
  const recent = features.slice(-recentCount);
  if (recent.length === 0) return 0.5;
  return recent.reduce((acc, f) => acc + f.novelty, 0) / recent.length;
}
