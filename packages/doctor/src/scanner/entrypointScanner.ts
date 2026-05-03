import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import type { Entrypoint } from "./types.js";

const NODE_BACKEND_CANDIDATES = [
  "apps/api/src/main.ts",
  "apps/api/src/main.js",
  "src/main.ts",
  "src/server.ts",
  "src/index.ts",
  "server.ts",
  "app.ts",
  "main.ts",
  "index.ts",
  "api/src/main.ts",
  "src/main.js",
];

const NEXT_API_GLOBS_HINT = ["app/api", "pages/api", "src/app/api", "src/pages/api"];

const FRONTEND_CANDIDATES = ["src/main.ts", "src/main.tsx", "src/app/app.config.ts", "src/main.js"];

const PYTHON = ["main.py", "app.py", "server.py", "api.py", "src/main.py"];

function fileExists(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

export function detectEntrypoints(
  projectRoot: string,
  deps: Record<string, string> = {},
): Entrypoint[] {
  const out: Entrypoint[] = [];

  for (const rel of NODE_BACKEND_CANDIDATES) {
    if (!fileExists(projectRoot, rel)) continue;
    const isAppsApi = rel.includes("apps/api") || rel.startsWith("api/");
    const fw =
      rel.includes("apps/api") && deps.fastify
        ? "fastify"
        : rel.includes("apps/api") && deps.express
          ? "express"
          : deps["@nestjs/core"]
            ? "nestjs"
            : isAppsApi
              ? "unknown"
              : "unknown";
    out.push({
      file: rel,
      framework: fw,
      type: "backend",
      confidence: isAppsApi ? "high" : "medium",
    });
  }

  for (const rel of FRONTEND_CANDIDATES) {
    if (!fileExists(projectRoot, rel)) continue;
    if (out.some((e) => e.file === rel)) continue;
    out.push({
      file: rel,
      framework: rel.includes("app.config") ? "angular" : "unknown",
      type: "frontend",
      confidence: "medium",
    });
  }

  for (const hint of NEXT_API_GLOBS_HINT) {
    if (existsSync(join(projectRoot, hint))) {
      out.push({
        file: hint,
        framework: "nextjs",
        type: "backend",
        confidence: "medium",
      });
    }
  }

  for (const rel of PYTHON) {
    if (!fileExists(projectRoot, rel)) continue;
    out.push({
      file: rel,
      framework: "python-fastapi",
      type: "backend",
      confidence: "low",
    });
  }

  const dedup = new Map<string, Entrypoint>();
  for (const e of out) {
    const prev = dedup.get(e.file);
    if (!prev || prev.confidence === "low") dedup.set(e.file, e);
  }
  return [...dedup.values()];
}

export function resolveEntrypointDisplayPath(projectRoot: string, absOrRel: string): string {
  if (absOrRel.startsWith(projectRoot)) return relative(projectRoot, absOrRel).replace(/\\/g, "/");
  return absOrRel.replace(/\\/g, "/");
}
