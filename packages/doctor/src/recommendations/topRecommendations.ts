import type { AiUsageFinding, DoctorScanReport, PackageFinding, SpectyraRecommendation } from "../scanner/types.js";
import { computeSdkInstallCommand } from "../scanner/monorepo.js";

function installHint(pm: DoctorScanReport["packageManager"], p: PackageFinding): string {
  return p.installCommand || computeSdkInstallCommand(pm, p);
}

export function buildTopRecommendations(report: DoctorScanReport): SpectyraRecommendation[] {
  const pm = report.packageManager ?? "npm";
  const list: SpectyraRecommendation[] = [];

  const planSteps = (report.integrationPlan?.steps ?? []).filter(
    (s) => s.status === "pending" || s.status === "warning" || s.status === "blocked",
  );
  for (const step of planSteps.slice(0, 4)) {
    list.push({
      priority: step.priority,
      title: step.title,
      summary: `${step.summary} Next: ${step.nextAction}`,
      setupLocation: step.targetFile,
      wrapperLocation: step.kind === "wrap-llm-call" || step.kind === "wrap-central-client" ? step.targetFile : undefined,
      suggestedCode: step.codeBlocks[0]?.code,
      notes: [...step.verifyChecks, ...step.notes].slice(0, 6),
      estimatedEffort: step.kind === "install-sdk" || step.kind === "add-auto-import" ? "5 minutes" : "30 minutes",
      confidence: step.status === "blocked" ? 0.95 : 0.88,
    });
  }

  const pkgsNeedingSdk = report.packages.filter((p) => !p.hasSpectyraSdk && report.aiFindings.some((f) => f.packageDir === p.packageDir));
  for (const p of pkgsNeedingSdk.slice(0, 6)) {
    list.push({
      priority: "critical",
      title: `Install @spectyra/sdk in ${p.packageDir === "." ? "workspace root" : p.packageDir}`,
      summary: `AI usage maps to this package but Spectyra is not listed in its package.json.`,
      installPackage: "@spectyra/sdk",
      suggestedCode: installHint(pm, p),
      notes: ["Run the install from your repo root or package folder; Doctor never runs installs for you."],
      estimatedEffort: "5 minutes",
      confidence: 0.95,
    });
  }

  const pkgsNeedingAuto = report.packages.filter((p) => p.hasSpectyraSdk && !p.hasSpectyraAutoImport && report.aiFindings.some((f) => f.packageDir === p.packageDir));
  for (const p of pkgsNeedingAuto.slice(0, 6)) {
    const entry = report.integrationPoints.find((x) => x.type === "server-entrypoint" && x.relativePath.startsWith(p.packageDir))?.relativePath ?? report.integrationPoints[0]?.relativePath;
    list.push({
      priority: "high",
      title: `Add import "@spectyra/sdk/auto" (${p.packageDir})`,
      summary: "SDK is installed but no auto import was detected in scanned sources for this package.",
      setupLocation: entry ?? "src/main.ts",
      suggestedImport: `import "@spectyra/sdk/auto";`,
      suggestedCode: `// ${entry ?? "src/main.ts"}\nimport "@spectyra/sdk/auto";`,
      notes: ["Place before other imports so fetch/HTTP instrumentation applies to downstream modules."],
      estimatedEffort: "5 minutes",
      confidence: 0.88,
    });
  }

  const gateway = report.integrationPoints.find((x) => x.type === "llm-wrapper");
  if (gateway) {
    list.push({
      priority: "high",
      title: `Central gateway: ${gateway.relativePath}`,
      summary: gateway.reason,
      wrapperLocation: gateway.relativePath,
      suggestedCode:
        "// Spectyra Doctor: central LLM gateway — prefer wrapping here.\n" +
        "import { createSpectyra, createOpenAIAdapter } from \"@spectyra/sdk\";\n" +
        "// Then route calls through spectyra.complete(...) with your provider adapter.",
      notes: ["Uses real exports from `@spectyra/sdk` (`createSpectyra`, provider adapters)."],
      estimatedEffort: "30 minutes",
      confidence: 0.7,
    });
  }

  return dedupeRecs(list);
}

function dedupeRecs(r: SpectyraRecommendation[]): SpectyraRecommendation[] {
  const seen = new Set<string>();
  const out: SpectyraRecommendation[] = [];
  for (const x of r) {
    const k = `${x.title}:${x.setupLocation ?? ""}:${x.wrapperLocation ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

export function mergeFindingRecommendations(findings: AiUsageFinding[]): SpectyraRecommendation[] {
  const out: SpectyraRecommendation[] = [];
  for (const f of findings.slice(0, 40)) {
    out.push(f.recommendation);
  }
  return dedupeRecs(out);
}
