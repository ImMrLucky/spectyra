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
  "api/src/main.ts",
  "apps/api/src/main.ts",
  "apps/api/src/index.ts",
  "apps/server/src/main.ts",
  "services/api/src/main.ts",
];

const NEXT_HINTS = ["app/api", "pages/api", "src/app/api", "src/pages/api", "middleware.ts", "next.config.js", "next.config.mjs", "next.config.ts"];

const PYTHON_ENTRY = ["main.py", "app.py", "server.py", "api.py", "src/main.py"];

const WRAPPER_NAMES = [
  "src/ai.ts",
  "src/aiClient.ts",
  "src/llm.ts",
  "src/llmClient.ts",
  "src/openai.ts",
  "src/anthropic.ts",
  "src/groq.ts",
  "src/gemini.ts",
  "src/modelClient.ts",
  "src/inference.ts",
  "src/completion.ts",
  "src/chat.ts",
  "src/agent.ts",
  "src/callLLM.ts",
  "lib/ai.ts",
  "lib/llm.ts",
];

const WRAPPER_PATH_HINT = /(\/|^)(lib|src)\/(ai|llm|openai|clients?|inference)\//i;

function findingHitsByPath(findings: AiUsageFinding[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const f of findings) {
    const rp = f.relativePath.replace(/\\/g, "/");
    m.set(rp, (m.get(rp) ?? 0) + 1);
  }
  return m;
}

export function scanIntegrationPoints(projectRoot: string, findings: AiUsageFinding[]): IntegrationPoint[] {
  const out: IntegrationPoint[] = [];
  const hits = findingHitsByPath(findings);

  for (const rel of SERVER_ENTRY) {
    const abs = join(projectRoot, rel);
    if (!existsSync(abs)) continue;
    const boost = (hits.get(rel.replace(/\\/g, "/")) ?? 0) * 0.04;
    out.push({
      filePath: abs,
      relativePath: rel.replace(/\\/g, "/"),
      type: "server-entrypoint",
      confidence: Math.min(0.99, (rel.includes("apps/api") ? 0.95 : 0.75) + boost),
      reason: "Common server bootstrap or API entry file",
      suggestedAction: `Add \`import "@spectyra/sdk/auto";\` as the first import in ${rel}.`,
    });
  }

  for (const rel of PYTHON_ENTRY) {
    const abs = join(projectRoot, rel);
    if (!existsSync(abs)) continue;
    out.push({
      filePath: abs,
      relativePath: rel,
      type: "server-entrypoint",
      confidence: 0.68,
      reason: "Python service entry candidate",
      suggestedAction: "For Node interop use the JS entry auto import; for pure Python, centralize HTTP clients and add Spectyra where you bridge to Node if applicable.",
    });
  }

  for (const h of NEXT_HINTS) {
    if (existsSync(join(projectRoot, h))) {
      out.push({
        filePath: join(projectRoot, h),
        relativePath: h,
        type: h.includes("next.config") ? "config" : "api-route",
        confidence: h.includes("next.config") ? 0.55 : 0.66,
        reason: "Next.js API or config surface",
        suggestedAction:
          "Ensure Spectyra loads in the Node server that handles these routes (often `instrumentation.ts` or the server entry importing `@spectyra/sdk/auto`).",
      });
    }
  }

  for (const rel of ["vite.config.ts", "vite.config.mts", "vite.config.js", "angular.json"]) {
    if (existsSync(join(projectRoot, rel))) {
      out.push({
        filePath: join(projectRoot, rel),
        relativePath: rel,
        type: "config",
        confidence: 0.52,
        reason: "Frontend bundler / framework config",
        suggestedAction: "Prefer server-side LLM calls; keep keys out of client bundles.",
      });
    }
  }

  for (const rel of WRAPPER_NAMES) {
    const abs = join(projectRoot, rel);
    if (!existsSync(abs)) continue;
    const n = hits.get(rel) ?? 0;
    out.push({
      filePath: abs,
      relativePath: rel,
      type: "llm-wrapper",
      confidence: Math.min(0.95, 0.72 + Math.min(0.2, n * 0.05)),
      reason: "Filename suggests a central LLM module",
      suggestedAction: `If this file owns provider calls, add Spectyra here once instead of every caller.`,
    });
  }

  for (const f of findings) {
    if (f.provider === "custom-gateway" && WRAPPER_PATH_HINT.test(f.relativePath)) {
      const n = hits.get(f.relativePath.replace(/\\/g, "/")) ?? 1;
      out.push({
        filePath: f.filePath,
        relativePath: f.relativePath,
        type: "llm-wrapper",
        confidence: Math.min(0.96, 0.82 + Math.min(0.12, n * 0.03)),
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
    const k = `${p.type}:${p.relativePath.replace(/\\/g, "/")}`;
    const prev = dedup.get(k);
    if (!prev || prev.confidence < p.confidence) dedup.set(k, p);
  }
  return [...dedup.values()].sort((a, b) => b.confidence - a.confidence);
}

export function primaryEntryFromPoints(points: IntegrationPoint[]): string {
  const ep = points.find((p) => p.type === "server-entrypoint");
  return ep?.relativePath ?? "src/main.ts";
}
