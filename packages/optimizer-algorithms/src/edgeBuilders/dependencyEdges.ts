import type { SemanticUnit, GraphEdge, PathKind } from "../types.js";

export function buildDependencyEdges(units: SemanticUnit[], path: PathKind): GraphEdge[] {
  if (path !== "code") return [];
  const edges: GraphEdge[] = [];
  const n = units.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ui = units[i];
      const uj = units[j];
      if (ui.kind === "patch" && (uj.kind === "code" || uj.kind === "patch")) {
        edges.push({ i, j, w: 0.7, type: "dependency" });
      }
      if (uj.kind === "patch" && (ui.kind === "code" || ui.kind === "patch")) {
        edges.push({ i, j, w: 0.7, type: "dependency" });
      }
      if (ui.kind === "constraint" && (uj.kind === "code" || uj.kind === "patch")) {
        const constraintText = ui.text.toLowerCase();
        const codeText = uj.text.toLowerCase();
        const identifiers = codeText.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g) || [];
        const mentioned = identifiers.some(id => constraintText.includes(id.toLowerCase()));
        edges.push({ i, j, w: mentioned ? 0.6 : 0.5, type: "dependency" });
      }
      if (uj.kind === "constraint" && (ui.kind === "code" || ui.kind === "patch")) {
        const constraintText = uj.text.toLowerCase();
        const codeText = ui.text.toLowerCase();
        const identifiers = codeText.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g) || [];
        const mentioned = identifiers.some(id => constraintText.includes(id.toLowerCase()));
        edges.push({ i, j, w: mentioned ? 0.6 : 0.5, type: "dependency" });
      }
      if (ui.kind === "code" && uj.kind === "code") {
        const defsI = extractDefinitions(ui.text);
        const defsJ = extractDefinitions(uj.text);
        const callsI = extractCalls(ui.text);
        const callsJ = extractCalls(uj.text);
        if (defsI.some(def => callsJ.includes(def)) || defsJ.some(def => callsI.includes(def))) {
          edges.push({ i, j, w: 0.6, type: "dependency" });
        }
      }
    }
  }
  return edges;
}

function extractDefinitions(text: string): string[] {
  const defs: string[] = [];
  const funcRe = /(?:function|const|let|var|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = funcRe.exec(text)) !== null) defs.push(m[1]);
  return defs;
}

function extractCalls(text: string): string[] {
  const calls: string[] = [];
  const callRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  const defs = new Set(extractDefinitions(text));
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(text)) !== null) {
    const name = m[1];
    if (!defs.has(name) && !["if", "for", "while", "switch", "catch"].includes(name)) calls.push(name);
  }
  return [...new Set(calls)];
}
