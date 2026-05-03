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
      code: `import '@spectyra/sdk/auto';`,
    },
    {
      title: "Explicit setup (recommended for production APIs)",
      language: "typescript",
      code: `import { startSpectyraAuto, useSpectyraAutoDevBridge } from '@spectyra/sdk/auto';

startSpectyraAuto({
  project: process.env.SPECTYRA_PROJECT ?? '${name}',
  environment: process.env.NODE_ENV ?? 'production',
  service: 'api',
  jsonlEnabled: true,
  consoleEnabled: true,
  cloudSync: process.env.SPECTYRA_CLOUD_SYNC === 'true',
  overlayEnabled: process.env.SPECTYRA_OVERLAY === 'true',
  spectyraCloudApiKey: process.env.SPECTYRA_CLOUD_API_KEY,
  spectyraApiBaseUrl: process.env.SPECTYRA_API_BASE_URL,
});

// After Fastify/Express app exists — lets the browser overlay read backend monitoring:
useSpectyraAutoDevBridge(app, {
  enabled: process.env.SPECTYRA_DEV_BRIDGE === '1',
  allowedHosts: ['localhost', '127.0.0.1'],
});`,
    },
    {
      title: "Preload (if AI modules import before Spectyra runs)",
      language: "bash",
      code: `node --import @spectyra/sdk/auto dist/main.js`,
    },
  ];

  const recs: IntegrationRecommendation[] = [];

  if (backendCalls || result.providers.length > 0) {
    recs.push({
      id: "backend-sdk-auto",
      title: "Backend: @spectyra/sdk/auto",
      summary:
        "Install Spectyra in the **same Node process** that performs LLM HTTP calls. `@spectyra/sdk/auto` includes monitoring, JSONL, dev bridge hooks, the live overlay (via dev bridge on the server), and optimizer-related instrumentation. Put the import at the very top of your server entry before route modules load.",
      targetFile: primaryEntry,
      codeBlocks: blocks,
      rank: 1,
    });
  }

  if (hasFrontend || result.userPlacement === "frontend" || result.userPlacement === "both") {
    recs.push({
      id: "frontend-overlay",
      title: "Browser: same runtime import",
      summary:
        "The live overlay is included with `import '@spectyra/sdk/auto'`. For backend APIs, enable the dev bridge so the browser can read monitoring data from `/__spectyra/*`. You normally do **not** need a second `@spectyra/devtools` import.",
      targetFile: "index.html or main.ts (frontend)",
      codeBlocks: [
        {
          title: "Frontend bundle (dev)",
          language: "typescript",
          code: `import '@spectyra/sdk/auto';`,
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
      summary:
        "No obvious AI HTTP patterns were detected. When you call OpenAI-compatible APIs from Node, add `import '@spectyra/sdk/auto'` at the process entry (or use `node --import @spectyra/sdk/auto`).",
      targetFile: primaryEntry,
      codeBlocks: blocks,
      rank: 1,
    });
  }

  return recs.sort((a, b) => a.rank - b.rank);
}
