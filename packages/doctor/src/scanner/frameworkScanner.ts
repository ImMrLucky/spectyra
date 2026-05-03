import type { DetectedFramework } from "./types.js";

const DEPS: Array<{ id: string; packages: string[]; confidence: DetectedFramework["confidence"] }> = [
  { id: "nestjs", packages: ["@nestjs/core"], confidence: "high" },
  { id: "express", packages: ["express"], confidence: "high" },
  { id: "fastify", packages: ["fastify"], confidence: "high" },
  { id: "koa", packages: ["koa"], confidence: "high" },
  { id: "nextjs", packages: ["next"], confidence: "high" },
  { id: "angular", packages: ["@angular/core"], confidence: "high" },
  { id: "react", packages: ["react", "react-dom"], confidence: "medium" },
  { id: "vite", packages: ["vite"], confidence: "high" },
];

export function detectFrameworks(deps: Record<string, string>, devDeps: Record<string, string>): DetectedFramework[] {
  const all = { ...devDeps, ...deps };
  const out: DetectedFramework[] = [];
  for (const row of DEPS) {
    const hits = row.packages.filter((p) => all[p]);
    if (hits.length === 0) continue;
    if (row.id === "react" && hits.length < 2) continue;
    out.push({
      id: row.id,
      confidence: row.confidence,
      evidence: [{ kind: "import", detail: `package.json: ${hits.join(", ")}` }],
    });
  }
  return out;
}
