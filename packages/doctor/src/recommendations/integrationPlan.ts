import { readFileSync } from "node:fs";
import type {
  AiUsageFinding,
  DoctorIntegrationPlan,
  DoctorIntegrationStep,
  DoctorScanReport,
  IntegrationPoint,
  PackageFinding,
} from "../scanner/types.js";
import {
  buildWrapperCodeForFinding,
  languageForFinding,
  suggestedWrapperFile,
} from "./codegen.js";

type Readiness = {
  status: DoctorIntegrationPlan["status"];
  score: number;
  blockers: string[];
  completed: string[];
};

const SPECTYRA_INTEGRATION_RE =
  /import\s+.*from\s+["']@spectyra\/sdk["']|createSpectyra\s*\(|createOpenAIAdapter\s*\(|createAnthropicAdapter\s*\(|createGroqAdapter\s*\(|spectyra\.complete\s*\(|@spectyra\/sdk\/auto|createSpectyraVercelAiOnFinish|createSpectyraLangChainMonitorCallbacks|createSpectyraLlamaIndexMonitorSubscriber/;

function stepPriority(status: DoctorIntegrationStep["status"], missingSdk: boolean): DoctorIntegrationStep["priority"] {
  if (missingSdk) return "critical";
  if (status === "warning" || status === "blocked") return "high";
  return "medium";
}

function pkgLabel(pkgDir: string): string {
  return pkgDir === "." ? "workspace root" : pkgDir;
}

function fallbackInstallCommand(pkg: PackageFinding): string {
  if (pkg.installCommand) return pkg.installCommand;
  if (pkg.packageManager === "pnpm") {
    const filter = pkg.name ?? (pkg.packageDir === "." ? "." : pkg.packageDir);
    return `pnpm --filter ${filter} add @spectyra/sdk`;
  }
  if (pkg.packageManager === "yarn") return `cd ${pkg.packageDir} && yarn add @spectyra/sdk`;
  if (pkg.packageManager === "bun") return `cd ${pkg.packageDir} && bun add @spectyra/sdk`;
  return `cd ${pkg.packageDir} && npm install @spectyra/sdk`;
}

function entryForPackage(report: DoctorScanReport, pkg: PackageFinding): IntegrationPoint | undefined {
  const points = report.integrationPoints.filter((p) => p.type === "server-entrypoint");
  const inPkg = points.find((p) => pkg.packageDir === "." || p.relativePath.startsWith(`${pkg.packageDir}/`));
  if (inPkg) return inPkg;
  return points[0];
}

function syntheticEntryForPackage(pkg: PackageFinding): string {
  if (pkg.packageDir !== ".") return `${pkg.packageDir}/src/main.ts`;
  return "src/main.ts";
}

function fileText(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function packageHasIntegrationEvidence(report: DoctorScanReport, pkgDir: string): boolean {
  const files = new Set<string>();
  for (const f of report.aiFindings) {
    if (f.packageDir === pkgDir) files.add(f.filePath);
  }
  for (const p of report.integrationPoints) {
    if (pkgDir === "." || p.relativePath.startsWith(`${pkgDir}/`)) files.add(p.filePath);
  }
  for (const f of files) {
    if (SPECTYRA_INTEGRATION_RE.test(fileText(f))) return true;
  }
  return false;
}

function findingHasLocalIntegrationEvidence(f: AiUsageFinding): boolean {
  return SPECTYRA_INTEGRATION_RE.test(fileText(f.filePath));
}

function hasBrowserKeyRisk(report: DoctorScanReport): boolean {
  return report.risks.some((r) => /browser|client-side|API-key/i.test(`${r.title} ${r.detail}`) && r.level !== "low");
}

function packagesWithAi(report: DoctorScanReport): PackageFinding[] {
  return report.packages.filter((p) => p.aiFindingCount > 0 || report.aiFindings.some((f) => f.packageDir === p.packageDir));
}

export function computeIntegrationReadiness(report: DoctorScanReport): Readiness {
  const blockers: string[] = [];
  const completed: string[] = [];
  const pkgs = packagesWithAi(report);

  if (report.aiFindings.length === 0) {
    return {
      status: "not-started",
      score: 0,
      blockers: ["No AI findings were detected yet."],
      completed,
    };
  }

  const missingSdk = pkgs.filter((p) => !p.hasSpectyraSdk);
  if (missingSdk.length) blockers.push(`Install @spectyra/sdk in ${missingSdk.map((p) => pkgLabel(p.packageDir)).join(", ")}.`);
  else completed.push("@spectyra/sdk installed in all packages with AI usage.");

  const missingAuto = pkgs.filter((p) => p.hasSpectyraSdk && !p.hasSpectyraAutoImport);
  if (missingAuto.length) blockers.push(`Add import "@spectyra/sdk/auto" for ${missingAuto.map((p) => pkgLabel(p.packageDir)).join(", ")}.`);
  else if (pkgs.length) completed.push("@spectyra/sdk/auto detected for packages with AI usage.");

  const wrappers = pkgs.filter((p) => packageHasIntegrationEvidence(report, p.packageDir));
  if (wrappers.length) completed.push(`Spectyra wrapper/monitor evidence found in ${wrappers.map((p) => pkgLabel(p.packageDir)).join(", ")}.`);
  const unwrapped = report.aiFindings.filter((f) => f.confidence >= 0.85 && !findingHasLocalIntegrationEvidence(f));
  if (unwrapped.length && wrappers.length) blockers.push(`${unwrapped.length} direct high-confidence LLM call(s) still need wrapper review.`);
  if (!wrappers.length) blockers.push("No createSpectyra/spectyra.complete/framework monitor hook evidence found yet.");

  if (hasBrowserKeyRisk(report)) blockers.push("Possible browser-side AI/API-key usage needs review.");

  let score = 10;
  if (!missingSdk.length) score += 30;
  if (!missingAuto.length && pkgs.length) score += 25;
  if (wrappers.length) score += 25;
  if (!hasBrowserKeyRisk(report)) score += 10;
  if (pkgs.length > 0 && missingSdk.length === pkgs.length) score = Math.min(score, 20);
  score = Math.min(100, Math.max(0, score));

  let status: Readiness["status"] = "in-progress";
  if (pkgs.length > 0 && missingSdk.length === pkgs.length) status = "not-started";
  else if (blockers.length > 0) status = missingSdk.length ? "in-progress" : "needs-attention";
  else status = "ready";

  return { status, score, blockers, completed };
}

function installStep(pkg: PackageFinding): DoctorIntegrationStep {
  const complete = pkg.hasSpectyraSdk;
  return {
    id: `install-sdk:${pkg.packageDir}`,
    kind: "install-sdk",
    status: complete ? "complete" : "pending",
    priority: complete ? "medium" : "critical",
    title: `Install @spectyra/sdk in ${pkgLabel(pkg.packageDir)}`,
    summary: complete
      ? "This package already lists @spectyra/sdk in package.json."
      : "This package owns detected LLM calls but does not list @spectyra/sdk in package.json.",
    packageDir: pkg.packageDir,
    codeBlocks: [
      {
        title: "Install command",
        language: "bash",
        code: fallbackInstallCommand(pkg),
        copyLabel: "Copy install command",
      },
    ],
    verifyChecks: [`${pkg.packageDir === "." ? "package.json" : `${pkg.packageDir}/package.json`} contains @spectyra/sdk`],
    notes: ["Doctor never runs installs automatically.", "Run this from your repo root unless the command includes cd."],
    nextAction: complete ? "Continue to the auto import step." : "Run the install command, then rescan Doctor.",
  };
}

function autoImportStep(report: DoctorScanReport, pkg: PackageFinding): DoctorIntegrationStep {
  const entry = entryForPackage(report, pkg);
  const targetFile = entry?.relativePath ?? syntheticEntryForPackage(pkg);
  const frontendish = /src\/main\.tsx$|src\/main\.jsx$|apps\/web\/|\/components\//i.test(targetFile);
  let status: DoctorIntegrationStep["status"] = pkg.hasSpectyraAutoImport ? "complete" : "pending";
  if (!pkg.hasSpectyraSdk) status = "blocked";
  if (frontendish && !pkg.hasSpectyraAutoImport) status = "warning";

  return {
    id: `add-auto-import:${pkg.packageDir}`,
    kind: "add-auto-import",
    status,
    priority: stepPriority(status, !pkg.hasSpectyraSdk),
    title: `Add Spectyra auto import in ${targetFile}`,
    summary: frontendish
      ? "Doctor found a frontend-looking entrypoint. Do not put API keys in browser code; add Spectyra to your backend/API layer."
      : "This enables automatic metadata capture and the SDK monitor bridge for supported Node HTTP paths.",
    targetFile,
    packageDir: pkg.packageDir,
    codeBlocks: [
      {
        title: `Add to top of ${targetFile}`,
        language: targetFile.endsWith(".js") ? "js" : "ts",
        code: `// Add this as the first import in your server entrypoint.
import "@spectyra/sdk/auto";

// Keep this above provider SDK imports and route imports.`,
        copyLabel: "Copy auto import",
      },
    ],
    verifyChecks: [`${targetFile} imports "@spectyra/sdk/auto"`],
    notes: [
      "Place this before OpenAI, Anthropic, Groq, route handlers, or HTTP client imports.",
      "This should be in the server-side app, not a browser-only entrypoint.",
    ],
    nextAction: pkg.hasSpectyraAutoImport ? "Continue to wrapper verification." : "Add the import, restart your app, then rescan Doctor.",
  };
}

function wrapperSteps(report: DoctorScanReport): DoctorIntegrationStep[] {
  const byKey = new Map<string, AiUsageFinding>();
  for (const f of report.aiFindings) {
    if (f.confidence < 0.65) continue;
    const target = suggestedWrapperFile(f, report.integrationPoints);
    const key = `${f.packageDir ?? "."}|${f.provider}|${target}|${f.callStyle}|${f.usageType}`;
    const prev = byKey.get(key);
    if (!prev || f.confidence > prev.confidence) byKey.set(key, f);
  }

  return [...byKey.values()]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10)
    .map((f) => {
      const target = suggestedWrapperFile(f, report.integrationPoints);
      const localIntegrated = findingHasLocalIntegrationEvidence(f);
      const packageIntegrated = f.packageDir ? packageHasIntegrationEvidence(report, f.packageDir) : false;
      const status: DoctorIntegrationStep["status"] = localIntegrated ? "complete" : packageIntegrated ? "warning" : "pending";
      return {
        id: `wrap:${f.provider}:${target}:${f.line}`,
        kind: f.callStyle === "custom-wrapper" || /llm|ai|client|openai|anthropic|groq/i.test(target) ? "wrap-central-client" : "wrap-llm-call",
        status,
        priority: f.confidence >= 0.85 ? "high" : "medium",
        title: localIntegrated ? `Spectyra wrapper detected near ${f.relativePath}` : `Wrap ${f.provider} call in ${target}`,
        summary: `Detected ${f.callStyle} ${f.usageType} usage at ${f.relativePath}:${f.line}. Use this wrapper so Spectyra can optimize and monitor the call.`,
        targetFile: target,
        targetLine: f.line,
        packageDir: f.packageDir,
        provider: f.provider,
        usageType: f.usageType,
        callStyle: f.callStyle,
        modelHints: f.modelHints,
        codeBlocks: [
          {
            title: `Detected call at ${f.relativePath}:${f.line}`,
            language: "text",
            code: f.snippet,
            copyLabel: "Copy detected snippet",
          },
          ...buildWrapperCodeForFinding(f, report.integrationPoints),
        ],
        verifyChecks: [
          `${target} imports createSpectyra from @spectyra/sdk`,
          `${target} calls spectyra.complete(...) or a framework monitor hook`,
          `Direct provider call at ${f.relativePath}:${f.line} routes through the wrapper`,
        ],
        notes: [
          f.isStreaming ? "Streaming usage detected. Preserve stream semantics; do not buffer the full response just to monitor it." : "",
          f.modelHints.length ? `Detected model hint: ${f.modelHints.join(", ")}` : "",
          packageIntegrated && !localIntegrated ? "Some Spectyra integration exists in this package, but this direct call still needs review." : "",
        ].filter(Boolean),
        nextAction: localIntegrated
          ? "Run your app and verify runtime events."
          : `Create/update ${target}, replace the direct call, then rescan Doctor.`,
      };
    });
}

function operationalSteps(readiness: Readiness): DoctorIntegrationStep[] {
  const runStep: DoctorIntegrationStep = {
    id: "run-app",
    kind: "run-app",
    status: readiness.status === "ready" ? "ready" : "pending",
    priority: "medium",
    title: "Run your app",
    summary: "Restart the app after adding @spectyra/sdk/auto and wrapper code so instrumentation loads before provider clients.",
    codeBlocks: [
      {
        title: "Run checklist",
        language: "text",
        copyLabel: "Copy run checklist",
        code: `1. Restart your app.
2. Exercise the route or workflow that makes an LLM call.
3. Return to Spectyra Doctor and click Verify integration.
4. Open the SDK monitor overlay or local companion when events appear.`,
      },
      {
        title: "Common environment",
        language: "bash",
        copyLabel: "Copy env vars",
        code: `SPECTYRA_RUN_MODE=on
SPECTYRA_LICENSE_KEY=<your Spectyra API key>
SPECTYRA_ENVIRONMENT=development`,
      },
    ],
    verifyChecks: ["Your app starts without import/order errors.", "The LLM path still returns a valid provider result."],
    notes: ["Do not move provider API keys into browser code.", "Env vars are common setup; use config-only mode if your app already configures Spectyra in code."],
    nextAction: "Start your app and use the LLM route once.",
  };

  const verifyStep: DoctorIntegrationStep = {
    id: "verify",
    kind: "verify",
    status: readiness.status === "ready" ? "ready" : "pending",
    priority: "medium",
    title: "Verify integration",
    summary: "Use Doctor's verify button to confirm static integration and, optionally, a running dev bridge.",
    codeBlocks: [
      {
        title: "Verify command",
        language: "bash",
        copyLabel: "Copy verify command",
        code: `spectyra-doctor verify`,
      },
    ],
    verifyChecks: ["@spectyra/sdk installed", "@spectyra/sdk/auto detected", "Spectyra wrapper/monitor evidence detected", "Runtime bridge reachable when configured"],
    notes: ["If you mount the dev bridge, enter its base URL in the Verification checklist section."],
    nextAction: "Click Verify integration after running your app.",
  };

  const monitorStep: DoctorIntegrationStep = {
    id: "open-monitor",
    kind: "open-monitor",
    status: readiness.status === "ready" ? "ready" : "pending",
    priority: "low",
    title: "Open SDK monitor / local companion",
    summary: "Once Doctor sees integration code, use your app normally and watch savings and LLM usage in the monitor overlay or local companion.",
    codeBlocks: [
      {
        title: "Monitor checklist",
        language: "text",
        copyLabel: "Copy monitor checklist",
        code: `Ready to monitor:
1. Start your app.
2. Use the LLM feature.
3. Open the Spectyra SDK monitor overlay or local companion.
4. Confirm events, provider, model, token usage, and estimated savings.`,
      },
    ],
    verifyChecks: ["Doctor status is ready or needs-attention with only low-risk notes.", "Runtime events appear in the SDK monitor/local companion."],
    notes: ["Runtime bridge path is typically /__spectyra when mounted by your app."],
    nextAction: "Switch to the Spectyra SDK monitor overlay or local companion.",
  };

  return [runStep, verifyStep, monitorStep];
}

export function buildIntegrationPlan(report: DoctorScanReport): DoctorIntegrationPlan {
  const readiness = computeIntegrationReadiness(report);
  const pkgs = packagesWithAi(report);
  const steps: DoctorIntegrationStep[] = [];

  for (const pkg of pkgs) steps.push(installStep(pkg));
  for (const pkg of pkgs) steps.push(autoImportStep(report, pkg));
  steps.push(...wrapperSteps(report));
  const ops = operationalSteps(readiness);
  steps.push(...ops);

  const nextPending = steps.find((s) => s.status === "pending" || s.status === "blocked" || s.status === "warning");
  const readyMessage =
    readiness.status === "ready"
      ? "Ready — Spectyra SDK is installed, sdk/auto is detected, and Spectyra integration code was found. Next: run your app and switch to the Spectyra SDK monitor overlay or local companion."
      : undefined;

  return {
    status: readiness.status,
    headline:
      readiness.status === "ready"
        ? "Ready to monitor"
        : nextPending
          ? `Next: ${nextPending.title}`
          : "Integration setup plan",
    summary:
      readiness.status === "ready"
        ? readyMessage!
        : `${readiness.score}% ready. Complete the pending setup steps, rescan, then verify runtime events.`,
    score: readiness.score,
    blockers: readiness.blockers,
    completed: readiness.completed,
    steps,
    readyMessage,
    monitorNextSteps: ops.slice(-1),
  };
}
