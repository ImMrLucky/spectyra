import type { SemanticUnit, GraphEdge, SpectralOptions, PathKind } from "../spectral/types";

const NEGATIONS = ["not", "never", "no", "can't", "cannot", "won't", "didn't", "isn't", "aren't", "wasn't", "weren't", "shouldn't", "wouldn't", "don't", "doesn't"];

const CONTRADICTION_PATTERNS = [
  // Direct opposites
  { pos: ["always", "must", "required"], neg: ["never", "optional", "forbidden"] },
  { pos: ["include", "add", "enable"], neg: ["exclude", "remove", "disable"] },
  { pos: ["increase", "more", "higher"], neg: ["decrease", "less", "lower"] },
  { pos: ["before", "prior", "first"], neg: ["after", "later", "last"] },
  
  // Status contradictions
  { pos: ["active", "enabled", "on"], neg: ["inactive", "disabled", "off"] },
  { pos: ["valid", "correct", "right"], neg: ["invalid", "incorrect", "wrong"] },
];

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches) return [];
  return matches.map(m => Number(m)).filter(n => Number.isFinite(n));
}

function hasNegation(text: string): boolean {
  const t = text.toLowerCase();
  return NEGATIONS.some(n => 
    new RegExp(`\\b${n}\\b`).test(t)
  );
}

function hasSemanticContradiction(a: string, b: string): boolean {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  for (const pattern of CONTRADICTION_PATTERNS) {
    const hasPos = pattern.pos.some(w => aLower.includes(w));
    const hasNeg = pattern.neg.some(w => bLower.includes(w));
    
    if (hasPos && hasNeg) return true;
    
    // Check reverse
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

// NEW: Detect temporal contradictions
function extractTemporalInfo(text: string): { hasTime: boolean; isPast: boolean; isFuture: boolean } {
  const t = text.toLowerCase();
  const pastMarkers = ["was", "were", "had", "did", "previous", "before", "earlier"];
  const futureMarkers = ["will", "shall", "going to", "next", "later", "upcoming"];
  
  return {
    hasTime: pastMarkers.some(m => t.includes(m)) || futureMarkers.some(m => t.includes(m)),
    isPast: pastMarkers.some(m => t.includes(m)),
    isFuture: futureMarkers.some(m => t.includes(m))
  };
}

export function buildContradictionEdges(units: SemanticUnit[], opts: SpectralOptions, path: PathKind): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const n = units.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = units[i].text;
      const b = units[j].text;

      const overlap = keywordOverlap(a, b);
      if (overlap < 1) continue;

      let contradictionWeight = 0;
      const reasons: string[] = [];

      // 1. Numeric contradiction
      const na = extractNumbers(a);
      const nb = extractNumbers(b);
      if (na.length > 0 && nb.length > 0) {
        for (const x of na) {
          for (const y of nb) {
            const diff = Math.abs(x - y);
            const relDiff = diff / (Math.max(Math.abs(x), Math.abs(y)) + 1e-6);
            
            if (diff >= 1e-6 && relDiff > 0.15) {
              contradictionWeight += 0.4 * Math.min(1, relDiff / 0.5);
              reasons.push("numeric");
              break;
            }
          }
        }
      }

      // 2. Negation contradiction
      const negConflict = (hasNegation(a) && !hasNegation(b)) || (!hasNegation(a) && hasNegation(b));
      if (negConflict) {
        contradictionWeight += 0.3;
        reasons.push("negation");
      }

      // 3. Semantic contradiction (NEW)
      if (hasSemanticContradiction(a, b)) {
        contradictionWeight += 0.35;
        reasons.push("semantic");
      }

      // 4. Temporal contradiction (NEW)
      const tempA = extractTemporalInfo(a);
      const tempB = extractTemporalInfo(b);
      if (tempA.hasTime && tempB.hasTime && overlap >= 2) {
        if ((tempA.isPast && tempB.isFuture) || (tempA.isFuture && tempB.isPast)) {
          contradictionWeight += 0.25;
          reasons.push("temporal");
        }
      }

      // Skip code blocks in code path (existing logic)
      const kindI = units[i].kind;
      const kindJ = units[j].kind;
      const bothCodey = (kindI === "code" || kindI === "patch") && (kindJ === "code" || kindJ === "patch");
      if (path === "code" && bothCodey) continue;

      // Only create edge if we detected contradiction
      if (contradictionWeight > 0.15) {
        // Use dynamic weight: scale by strength, but respect the configured base weight
        // Cap at the configured weight, but allow weaker contradictions
        const baseWeight = Math.abs(opts.contradictionEdgeWeight);
        const finalWeight = -Math.min(baseWeight, Math.max(0.3, contradictionWeight * baseWeight));
        edges.push({ 
          i, 
          j, 
          w: finalWeight, 
          type: "contradiction"
        });
      }
    }
  }

  return edges;
}
