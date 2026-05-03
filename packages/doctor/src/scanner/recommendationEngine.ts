import type { DoctorScanResult, IntegrationRecommendation } from "./types.js";

function projectNameFromRoot(root: string): string {
  const parts = root.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "my-app";
}

export function buildRecommendations(result: DoctorScanResult): IntegrationRecommendation[] {
  const name = projectNameFromRoot(result.projectRoot);
  const backendCalls = result.aiCallSites.some(
    (s) => !s.file.includes("apps/admin") && !s.file.includes("apps/web"),
  );
  const hasFrontend = result.frameworks.some((f) => f.id === "angular" || f.id === "react" || f.id === "vite");
  const primaryEntry = result.entrypoints.find((e) => e.type === "backend")?.file ?? "src/main.ts";

  const blocks: IntegrationRecommendation["codeBlocks"] = [
    {
      title: "Minimal (side-effect import)",
      language: "typescript",
      code: `import '@spectyra/auto';`,
    },
    {
      title: "Explicit setup (recommended for production APIs)",
      language: "typescript",
      code: `import { startSpectyraAuto, useSpectyraAutoDevBridge } from '@spectyra/auto';

startSpectyraAuto({
  project: '${name}',
  environment: process.env.NODE_ENV ?? 'production',
  service: 'api',
  jsonlEnabled: true,
  jsonlPath: process.env.SPECTYRA_JSONL_PATH ?? '/tmp/spectyra-usage.jsonl',
  cloudSync: process.env.SPECTYRA_CLOUD_SYNC === 'true',
  spectyraCloudApiKey: process.env.SPECTYRA_CLOUD_API_KEY,
  spectyraApiBaseUrl: process.env.SPECTYRA_API_BASE_URL,
  console: process.env.SPECTYRA_CONSOLE === 'true',
});

// After Fastify/Express app exists:
useSpectyraAutoDevBridge(app, {
  enabled: process.env.SPECTYRA_DEV_BRIDGE === '1' || process.env.SPECTYRA_OVERLAY_DEV === 'true',
  allowedHosts: ['localhost', '127.0.0.1'],
});`,
    },
    {
      title: "Preload (if AI modules import before Spectyra runs)",
      language: "bash",
      code: `node --import @spectyra/auto dist/main.js`,
    },
  ];

  const recs: IntegrationRecommendation[] = [];

  if (backendCalls || result.providers.length > 0) {
    recs.push({
      id: "backend-auto",
      title: "Backend: @spectyra/auto",
      summary:
        "Install and start Spectyra in the **same Node process** that performs LLM HTTP calls. Place imports at the top of your server entry before route modules load.",
      targetFile: primaryEntry,
      codeBlocks: blocks,
      rank: 1,
    });
  }

  if (hasFrontend || result.userPlacement === "frontend" || result.userPlacement === "both") {
    recs.push({
      id: "frontend-devtools",
      title: "Browser overlay: @spectyra/devtools",
      summary:
        "The overlay reads monitor data from your API's dev bridge. Enable `SPECTYRA_DEV_BRIDGE` (or equivalent) on the backend and load devtools in the frontend bundle.",
      targetFile: "index.html or main.ts (frontend)",
      codeBlocks: [
        {
          title: "Frontend",
          language: "typescript",
          code: `import '@spectyra/devtools/auto';`,
        },
      ],
      rank: 2,
    });
  }

  if (result.projectType === "python") {
    recs.push({
      id: "python",
      title: "Python: spectyra_auto + dev router",
      summary: "Use the Spectyra Python SDK bridge for FastAPI/Flask.",
      targetFile: "main.py",
      codeBlocks: [
        {
          title: "FastAPI (example)",
          language: "python",
          code: `from spectyra.dev.fastapi_integration import spectyra_router
app.include_router(spectyra_router(), prefix="/__spectyra")`,
        },
      ],
      rank: 1,
    });
  }

  if (recs.length === 0) {
    recs.push({
      id: "generic",
      title: "Add Spectyra when you add LLM calls",
      summary: "No obvious AI HTTP patterns were detected. When you call OpenAI-compatible APIs from Node, add @spectyra/auto at process entry.",
      targetFile: primaryEntry,
      codeBlocks: blocks,
      rank: 1,
    });
  }

  return recs.sort((a, b) => a.rank - b.rank);
}
