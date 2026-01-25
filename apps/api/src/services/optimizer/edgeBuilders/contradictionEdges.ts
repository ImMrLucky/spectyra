import type { SemanticUnit, GraphEdge, SpectralOptions, PathKind } from "../spectral/types";

const NEGATIONS = ["not", "never", "no", "can't", "cannot", "won't", "didn't", "isn't", "aren't", "wasn't", "weren't"];

function extractNumbers(text: string): number[] {
  const matches = text.match(/-?\d+(\.\d+)?/g);
  if (!matches) return [];
  return matches.map(m => Number(m)).filter(n => Number.isFinite(n));
}

function hasNegation(text: string): boolean {
  const t = text.toLowerCase();
  return NEGATIONS.some(n => t.includes(` ${n} `) || t.startsWith(`${n} `));
}

function keywordOverlap(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 4));
  const wb = new Set(b.toLowerCase().split(/[^a-z0-9]+/).filter(x => x.length >= 4));
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter;
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

      // Numeric contradiction: both mention numbers and differ significantly
      const na = extractNumbers(a);
      const nb = extractNumbers(b);
      let numericConflict = false;
      if (na.length > 0 && nb.length > 0) {
        // if any pair differs beyond a threshold
        outer: for (const x of na) {
          for (const y of nb) {
            const diff = Math.abs(x - y);
            if (diff >= 1e-6 && diff / (Math.abs(x) + 1e-6) > 0.15) { // 15% difference
              numericConflict = true;
              break outer;
            }
          }
        }
      }

      const negConflict =
        (hasNegation(a) && !hasNegation(b)) ||
        (!hasNegation(a) && hasNegation(b));

      // Code path: avoid false contradictions on code blocks; focus on prose constraints
      const kindI = units[i].kind;
      const kindJ = units[j].kind;
      const bothCodey = (kindI === "code" || kindI === "patch") && (kindJ === "code" || kindJ === "patch");

      if (path === "code" && bothCodey) continue;

      if (numericConflict || negConflict) {
        edges.push({ i, j, w: opts.contradictionEdgeWeight, type: "contradiction" });
      }
    }
  }

  return edges;
}
