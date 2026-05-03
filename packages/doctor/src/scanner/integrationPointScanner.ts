import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AiUsageFinding, IntegrationPoint } from "./types.js";

const SERVER_ENTRY = [
  "src/main.ts",
  "src/main.js",
  "src/index.ts",
  "src/index.js",
  "src/server.ts",
  "src/server.js",
  "server.ts",
  "server.js",
  "app.ts",
  "app.js",
  "main.ts",
  "main.js",
  "index.ts",
  "index.js",
  "apps/api/src/main.ts",
  "apps/api/src/main.js",
  "api/src/main.ts",
  "apps/server/src/main.ts",
];

const WRAPPER_PATH_HINT = /(\/|^)(lib|src)\/(ai|llm|openai|clients?|inference)\//i;

export function scanIntegrationPoints(
  projectRoot: string,
  findings: AiUsageFinding[],
): IntegrationPoint[] {
  const out: IntegrationPoint[] = [];

  for (const rel of SERVER_ENTRY) {
    const abs = join(projectRoot, rel);
    if (!existsSync(abs)) continue;
    out.push({
      filePath: abs,
      relativePath: rel.replace(/\\/g, "/"),
      type: "server-entrypoint",
      confidence: rel.includes("apps/api") ? 0.95 : 0.75,
      reason: "Common Node/TS server bootstrap file",
      suggestedAction: `Add \`import "@spectyra/sdk/auto";\` as the first import in ${rel}.`,
    });
  }

  const nextHints = ["app/api", "pages/api", "src/app/api", "src/pages/api", "middleware.ts"];
  for (const h of nextHints) {
    if (existsSync(join(projectRoot, h))) {
      out.push({
        filePath: join(projectRoot, h),
        relativePath: h,
        type: "api-route",
        confidence: 0.65,
        reason: "Next.js-style API area detected",
        suggestedAction: "Ensure Spectyra loads in the Node server that handles these routes (often `instrumentation.ts` or server entry).",
      });
    }
  }

  for (const f of findings) {
    if (f.provider === "custom-gateway" && WRAPPER_PATH_HINT.test(f.relativePath)) {
      out.push({
        filePath: f.filePath,
        relativePath: f.relativePath,
        type: "llm-wrapper",
        confidence: 0.85,
        reason: "Central-looking path with custom LLM entrypoint",
        suggestedAction: `Add Spectyra once in ${f.relativePath} (gateway) instead of every caller.`,
      });
    }
    if (f.callStyle === "sdk" && /\/(services|lib|clients)\//i.test(f.relativePath)) {
      out.push({
        filePath: f.filePath,
        relativePath: f.relativePath,
        type: "provider-client",
        confidence: 0.7,
        reason: "SDK usage under services/lib",
        suggestedAction: "Wrap the exported client factory with `createSpectyra` + the matching adapter.",
      });
    }
  }

  const dedup = new Map<string, IntegrationPoint>();
  for (const p of out) {
    const k = `${p.type}:${p.relativePath}`;
    const prev = dedup.get(k);
    if (!prev || prev.confidence < p.confidence) dedup.set(k, p);
  }
  return [...dedup.values()].sort((a, b) => b.confidence - a.confidence);
}

export function primaryEntryFromPoints(points: IntegrationPoint[]): string {
  const ep = points.find((p) => p.type === "server-entrypoint");
  return ep?.relativePath ?? "src/main.ts";
}
