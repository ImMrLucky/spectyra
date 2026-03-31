import type { SemanticUnit, GraphEdge, SpectralOptions, PathKind } from "../types.js";
import { cosine } from "../math.js";

const NEGATIONS = ["not", "never", "no", "can't", "cannot", "won't", "didn't", "isn't", "aren't", "wasn't", "weren't", "shouldn't", "wouldn't", "don't", "doesn't"];

const OVERRIDE_CUES = ["actually", "instead", "correction", "corrected", "update:", "updated:", "fix:", "fixed", "rather", "scratch that", "ignore previous", "disregard"];

const CONTRADICTION_PATTERNS = [
  { pos: ["always", "must", "required"], neg: ["never", "optional", "forbidden"] },
  { pos: ["include", "add", "enable"], neg: ["exclude", "remove", "disable"] },
  { pos: ["increase", "more", "higher"], neg: ["decrease", "less", "lower"] },
  { pos: ["before", "prior", "first"], neg: ["after", "later", "last"] },
  { pos: ["active", "enabled", "on"], neg: ["inactive", "disabled", "off"] },
  { pos: ["valid", "correct", "right"], neg: ["invalid", "incorrect", "wrong"] },
  { pos: ["above"], neg: ["below"] },
  { pos: ["sync", "synchronous"], neg: ["async", "asynchronous"] },
  { pos: ["public"], neg: ["private"] },
  { pos: ["mutable"], neg: ["immutable"] },
];

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches) return [];
  return matches.map(m => Number(m)).filter(n => Number.isFinite(n));
}

function hasNegation(text: string): boolean {
  const t = text.toLowerCase();
  return NEGATIONS.some(n => new RegExp(`\\b${n}\\b`).test(t));
}

function hasSemanticContradiction(a: string, b: string): boolean {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  for (const pattern of CONTRADICTION_PATTERNS) {
    const hasPos = pattern.pos.some(w => aLower.includes(w));
    const hasNeg = pattern.neg.some(w => bLower.includes(w));
    if (hasPos && hasNeg) return true;
    const hasPosB = pattern.pos.some(w => bLower.includes(w));
    const hasNegA = pattern.neg.some(w => aLower.includes(w));
    if (hasPosB && hasNegA) return true;
  }
  return false;
}

function keywordOverlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 4));
  const wb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 4));
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter;
}

function hasOverrideCue(text: string): boolean {
  const t = text.toLowerCase();
  return OVERRIDE_CUES.some(cue => t.includes(cue));
}

function computeTemporalPenalty(unitA: SemanticUnit, unitB: SemanticUnit): number {
  const newer = unitA.createdAtTurn > unitB.createdAtTurn ? unitA : unitB;
  if (hasOverrideCue(newer.text)) return 0.2;
  return 0;
}

function embeddingDissimilarity(unitA: SemanticUnit, unitB: SemanticUnit): number {
  if (!unitA.embedding || !unitB.embedding) return 0;
  const sim = cosine(unitA.embedding, unitB.embedding);
  if (sim < 0.3) return 0.25 * (1 - sim / 0.3);
  return 0;
}

export function buildContradictionEdges(units: SemanticUnit[], opts: SpectralOptions, path: PathKind): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const n = units.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = units[i].text;
      const b = units[j].text;
      const overlap = keywordOverlap(a, b);
      const embDissim = embeddingDissimilarity(units[i], units[j]);

      if (overlap < 1 && embDissim === 0) continue;

      let contradictionWeight = 0;
      const na = extractNumbers(a);
      const nb = extractNumbers(b);
      if (na.length > 0 && nb.length > 0) {
        for (const x of na) {
          for (const y of nb) {
            const diff = Math.abs(x - y);
            const relDiff = diff / (Math.max(Math.abs(x), Math.abs(y)) + 1e-6);
            if (diff >= 1e-6 && relDiff > 0.15) {
              contradictionWeight += 0.4 * Math.min(1, relDiff / 0.5);
              break;
            }
          }
        }
      }
      const negConflict = (hasNegation(a) && !hasNegation(b)) || (!hasNegation(a) && hasNegation(b));
      if (negConflict) contradictionWeight += 0.3;
      if (hasSemanticContradiction(a, b)) contradictionWeight += 0.35;

      contradictionWeight += embDissim;
      contradictionWeight += computeTemporalPenalty(units[i], units[j]);

      const kindI = units[i].kind;
      const kindJ = units[j].kind;
      const bothCodey = (kindI === "code" || kindI === "patch") && (kindJ === "code" || kindJ === "patch");
      if (path === "code" && bothCodey) continue;
      if (contradictionWeight > 0.15) {
        const baseWeight = Math.abs(opts.contradictionEdgeWeight);
        const finalWeight = -Math.min(baseWeight, Math.max(0.3, contradictionWeight * baseWeight));
        edges.push({ i, j, w: finalWeight, type: "contradiction" });
      }
    }
  }
  return edges;
}
