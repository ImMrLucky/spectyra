/**
 * Dependency Edges - Code path dependency detection
 * 
 * Builds dependency edges between code units, patches, and constraints.
 * Only used for path === "code".
 */

import type { SemanticUnit, GraphEdge, PathKind } from "../spectral/types.js";

export function buildDependencyEdges(
  units: SemanticUnit[],
  path: PathKind
): GraphEdge[] {
  if (path !== "code") {
    return []; // Only for code path
  }

  const edges: GraphEdge[] = [];
  const n = units.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ui = units[i];
      const uj = units[j];

      // Rule 1: Patch → code blocks (positive weight 0.7)
      if (ui.kind === "patch" && (uj.kind === "code" || uj.kind === "patch")) {
        edges.push({ i, j, w: 0.7, type: "dependency" });
      }
      if (uj.kind === "patch" && (ui.kind === "code" || ui.kind === "patch")) {
        edges.push({ i, j, w: 0.7, type: "dependency" });
      }

      // Rule 2: Constraint → relevant code blocks (positive weight 0.5-0.7)
      if (ui.kind === "constraint" && (uj.kind === "code" || uj.kind === "patch")) {
        // Check if constraint mentions identifiers from code
        const constraintText = ui.text.toLowerCase();
        const codeText = uj.text.toLowerCase();
        
        // Extract potential identifiers (simple heuristic: words that look like function/var names)
        const identifiers = codeText.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g) || [];
        const mentioned = identifiers.some(id => constraintText.includes(id.toLowerCase()));
        
        if (mentioned) {
          edges.push({ i, j, w: 0.6, type: "dependency" });
        } else {
          // Still add weaker edge if constraint is near code
          edges.push({ i, j, w: 0.5, type: "dependency" });
        }
      }
      if (uj.kind === "constraint" && (ui.kind === "code" || ui.kind === "patch")) {
        const constraintText = uj.text.toLowerCase();
        const codeText = ui.text.toLowerCase();
        const identifiers = codeText.match(/\b[a-zA-Z_][a-zA-Z0-9_]{2,}\b/g) || [];
        const mentioned = identifiers.some(id => constraintText.includes(id.toLowerCase()));
        
        if (mentioned) {
          edges.push({ i, j, w: 0.6, type: "dependency" });
        } else {
          edges.push({ i, j, w: 0.5, type: "dependency" });
        }
      }

      // Rule 3: Code block referencing identifier defined in another block (weight 0.6)
      if (ui.kind === "code" && uj.kind === "code") {
        // Extract function/class definitions and calls
        const defsI = extractDefinitions(ui.text);
        const defsJ = extractDefinitions(uj.text);
        const callsI = extractCalls(ui.text);
        const callsJ = extractCalls(uj.text);

        // If i defines something that j calls, or vice versa
        const iDefinesJCalls = defsI.some(def => callsJ.includes(def));
        const jDefinesICalls = defsJ.some(def => callsI.includes(def));

        if (iDefinesJCalls || jDefinesICalls) {
          edges.push({ i, j, w: 0.6, type: "dependency" });
        }
      }
    }
  }

  return edges;
}

/**
 * Extract function/class definitions from code text
 */
function extractDefinitions(text: string): string[] {
  const defs: string[] = [];
  
  // Function definitions: function name(...) or const name = (...) =>
  const funcRe = /(?:function|const|let|var|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  let m: RegExpExecArray | null;
  while ((m = funcRe.exec(text)) !== null) {
    defs.push(m[1]);
  }
  
  return defs;
}

/**
 * Extract function calls from code text
 */
function extractCalls(text: string): string[] {
  const calls: string[] = [];
  
  // Function calls: name(...) but not definitions
  const callRe = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g;
  const defs = new Set(extractDefinitions(text));
  
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(text)) !== null) {
    const name = m[1];
    // Skip if it's a definition, skip common keywords
    if (!defs.has(name) && !["if", "for", "while", "switch", "catch"].includes(name)) {
      calls.push(name);
    }
  }
  
  return [...new Set(calls)]; // Deduplicate
}
