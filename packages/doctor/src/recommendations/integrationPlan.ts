import { readFileSync } from "node:fs";
import type {
  AiUsageFinding,
  DoctorIntegrationReadiness,
  DoctorIntegrationPlan,
  DoctorIntegrationStep,
  DoctorIntegrationTrack,
  DoctorScanReport,
  IntegrationPoint,
  PackageFinding,
} from "../scanner/types.js";
import {
  buildCliHarnessIntegrationBlocks,
  cliToolTitle,
  suggestedCliWrapperFile,
} from "./cliHarnessCodegen.js";
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
  detail: DoctorIntegrationReadiness;
};

const SPECTYRA_INTEGRATION_RE =
  /import\s+.*from\s+["']@spectyra\/sdk["']|createSpectyra\s*\(|createOpenAIAdapter\s*\(|createAnthropicAdapter\s*\(|createGroqAdapter\s*\(|spectyra\.complete\s*\(|@spectyra\/sdk\/auto|createSpectyraVercelAiOnFinish|createSpectyraLangChainMonitorCallbacks|createSpectyraLlamaIndexMonitorSubscriber/;
const SPECTYRA_CLI_INTEGRATION_RE =
  /@spectyra\/sdk\/cli|createCliHarness\s*\(|createClaudeCliHarness\s*\(|createGeminiCliHarness\s*\(|createCodexCliHarness\s*\(|runClaudeWithSpectyra\s*\(|runGeminiWithSpectyra\s*\(|runCodexWithSpectyra\s*\(|runAiCliWithSpectyra\s*\(/;
const CLI_WRAPPER_PATH_RE = /(^|\/)src\/(lib\/ai|ai)\/[^/]*(CliHarness|Harness)\.[cm]?[tj]sx?$/i;

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

function packageHasCliIntegrationEvidence(report: DoctorScanReport, pkgDir: string): boolean {
  const files = new Set<string>();
  for (const f of report.aiFindings) {
    if (f.packageDir === pkgDir) files.add(f.filePath);
  }
  for (const p of report.integrationPoints) {
    if (pkgDir === "." || p.relativePath.startsWith(`${pkgDir}/`)) files.add(p.filePath);
  }
  for (const f of files) {
    if (SPECTYRA_CLI_INTEGRATION_RE.test(fileText(f))) return true;
  }
  return false;
}

function isCliWrapperPath(relativePath: string): boolean {
  return CLI_WRAPPER_PATH_RE.test(relativePath);
}

function findingHasLocalIntegrationEvidence(f: AiUsageFinding): boolean {
  const text = fileText(f.filePath);
  if (f.callStyle === "cli" || f.isCliHarness) return isCliWrapperPath(f.relativePath) && SPECTYRA_CLI_INTEGRATION_RE.test(text);
  return SPECTYRA_INTEGRATION_RE.test(text);
}

function hasBrowserKeyRisk(report: DoctorScanReport): boolean {
  return report.risks.some((r) => /browser|client-side|API-key/i.test(`${r.title} ${r.detail}`) && r.level !== "low");
}

function packagesWithAi(report: DoctorScanReport): PackageFinding[] {
  return report.packages.filter((p) => p.aiFindingCount > 0 || report.aiFindings.some((f) => f.packageDir === p.packageDir));
}

function isCliFinding(f: AiUsageFinding): boolean {
  return f.callStyle === "cli" || f.isCliHarness === true;
}

function isPersistentCliFinding(f: AiUsageFinding): boolean {
  return isCliFinding(f) && f.cliRunMode === "persistent-session";
}

function isAcpFinding(f: AiUsageFinding): boolean {
  return f.callStyle === "acp" || f.isAcpHarness === true;
}

function isProviderFinding(f: AiUsageFinding): boolean {
  return !isCliFinding(f) && !isAcpFinding(f) && (f.callStyle === "sdk" || f.callStyle === "http" || f.callStyle === "framework" || f.callStyle === "custom-wrapper");
}

function packagesForFindings(report: DoctorScanReport, predicate: (f: AiUsageFinding) => boolean): PackageFinding[] {
  const dirs = new Set(report.aiFindings.filter(predicate).map((f) => f.packageDir ?? "."));
  return report.packages.filter((p) => dirs.has(p.packageDir));
}

function trackStatus(input: { detected: boolean; missingSdk: number; wrappers: number; unwrapped: number }): DoctorIntegrationReadiness["providerSdkStatus"] {
  if (!input.detected) return "not-detected";
  if (input.missingSdk > 0 && input.wrappers === 0) return "not-started";
  if (input.wrappers > 0 && input.unwrapped === 0 && input.missingSdk === 0) return "ready";
  return "in-progress";
}

export function computeIntegrationReadiness(report: DoctorScanReport): Readiness {
  const blockers: string[] = [];
  const completed: string[] = [];
  const pkgs = packagesWithAi(report);
  const providerFindings = report.aiFindings.filter(isProviderFinding);
  const cliFindings = report.aiFindings.filter(isCliFinding);
  const providerPkgs = packagesForFindings(report, isProviderFinding);
  const cliPkgs = packagesForFindings(report, isCliFinding);

  if (report.aiFindings.length === 0) {
    const detail: DoctorIntegrationReadiness = {
      overallStatus: "not-started",
      providerSdkStatus: "not-detected",
      cliHarnessStatus: "not-detected",
      blockers: ["No AI findings were detected yet."],
      completed,
    };
    return {
      status: "not-started",
      score: 0,
      blockers: ["No AI findings were detected yet."],
      completed,
      detail,
    };
  }

  const missingSdk = pkgs.filter((p) => !p.hasSpectyraSdk);
  if (missingSdk.length) blockers.push(`Install @spectyra/sdk in ${missingSdk.map((p) => pkgLabel(p.packageDir)).join(", ")}.`);
  else completed.push("@spectyra/sdk installed in all packages with AI usage.");

  const missingAuto = pkgs.filter((p) => p.hasSpectyraSdk && !p.hasSpectyraAutoImport);
  if (missingAuto.length) blockers.push(`Add import "@spectyra/sdk/auto" for ${missingAuto.map((p) => pkgLabel(p.packageDir)).join(", ")}.`);
  else if (pkgs.length) completed.push("@spectyra/sdk/auto detected for packages with AI usage.");

  const wrappers = providerPkgs.filter((p) => packageHasIntegrationEvidence(report, p.packageDir));
  if (wrappers.length) completed.push(`Spectyra provider wrapper/monitor evidence found in ${wrappers.map((p) => pkgLabel(p.packageDir)).join(", ")}.`);
  const unwrapped = providerFindings.filter((f) => f.confidence >= 0.85 && !findingHasLocalIntegrationEvidence(f));
  if (unwrapped.length && wrappers.length) blockers.push(`${unwrapped.length} direct high-confidence LLM call(s) still need wrapper review.`);
  if (providerFindings.length && !wrappers.length) blockers.push("No createSpectyra/spectyra.complete/framework monitor hook evidence found yet.");

  if (hasBrowserKeyRisk(report)) blockers.push("Possible browser-side AI/API-key usage needs review.");

  const providerMissingSdk = providerPkgs.filter((p) => !p.hasSpectyraSdk);
  const cliMissingSdk = cliPkgs.filter((p) => !p.hasSpectyraSdk);
  const providerWrappers = providerPkgs.filter((p) => packageHasIntegrationEvidence(report, p.packageDir));
  const cliWrappers = cliPkgs.filter((p) => packageHasCliIntegrationEvidence(report, p.packageDir));
  const providerUnwrapped = providerFindings.filter((f) => f.confidence >= 0.85 && !findingHasLocalIntegrationEvidence(f));
  const cliUnwrapped = cliFindings.filter((f) => f.confidence >= 0.85 && !findingHasLocalIntegrationEvidence(f));
  if (providerFindings.length) {
    if (providerUnwrapped.length && providerWrappers.length) blockers.push(`${providerUnwrapped.length} provider SDK/API call(s) still need Spectyra wrapper review.`);
    else if (!providerUnwrapped.length && providerWrappers.length && !providerMissingSdk.length) completed.push("Provider SDK/API track is ready.");
  }
  if (cliFindings.length) {
    if (!cliWrappers.length) blockers.push("No @spectyra/sdk/cli harness wrapper evidence found yet.");
    else completed.push("@spectyra/sdk/cli harness wrapper evidence found.");
    if (cliUnwrapped.length && cliWrappers.length) blockers.push(`${cliUnwrapped.length} raw AI CLI call(s) still bypass Spectyra.`);
    else if (!cliUnwrapped.length && cliWrappers.length && !cliMissingSdk.length) completed.push("AI CLI harness track is ready.");
  }

  let score = 10;
  if (!missingSdk.length) score += 30;
  if (!missingAuto.length && pkgs.length) score += 25;
  if (wrappers.length || cliWrappers.length) score += 25;
  if (!hasBrowserKeyRisk(report)) score += 10;
  if (pkgs.length > 0 && missingSdk.length === pkgs.length) score = Math.min(score, 20);
  score = Math.min(100, Math.max(0, score));

  let status: Readiness["status"] = "in-progress";
  if (pkgs.length > 0 && missingSdk.length === pkgs.length) status = "not-started";
  else if (blockers.length > 0) status = missingSdk.length ? "in-progress" : "needs-attention";
  else status = "ready";

  const detail: DoctorIntegrationReadiness = {
    overallStatus: status,
    providerSdkStatus: trackStatus({
      detected: providerFindings.length > 0,
      missingSdk: providerMissingSdk.length,
      wrappers: providerWrappers.length,
      unwrapped: providerUnwrapped.length,
    }),
    cliHarnessStatus: trackStatus({
      detected: cliFindings.length > 0,
      missingSdk: cliMissingSdk.length,
      wrappers: cliWrappers.length,
      unwrapped: cliUnwrapped.length,
    }),
    blockers,
    completed,
  };

  if (
    (detail.providerSdkStatus === "ready" || detail.providerSdkStatus === "not-detected") &&
    (detail.cliHarnessStatus === "ready" || detail.cliHarnessStatus === "not-detected") &&
    (detail.providerSdkStatus === "ready" || detail.cliHarnessStatus === "ready") &&
    !hasBrowserKeyRisk(report)
  ) {
    detail.overallStatus = "ready";
    status = "ready";
    score = Math.max(score, 95);
  } else {
    detail.overallStatus = status;
  }

  return { status, score, blockers, completed, detail };
}

function installStep(pkg: PackageFinding, track: DoctorIntegrationStep["track"] = "provider-sdk"): DoctorIntegrationStep {
  const complete = pkg.hasSpectyraSdk;
  return {
    id: `install-sdk:${track}:${pkg.packageDir}`,
    kind: "install-sdk",
    status: complete ? "complete" : "pending",
    priority: complete ? "medium" : "critical",
    title: `Install @spectyra/sdk in ${pkgLabel(pkg.packageDir)}`,
    summary: complete
      ? "This package already lists @spectyra/sdk in package.json."
      : "This package owns detected LLM calls but does not list @spectyra/sdk in package.json.",
    packageDir: pkg.packageDir,
    track,
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

function autoImportStep(
  report: DoctorScanReport,
  pkg: PackageFinding,
  track: DoctorIntegrationStep["track"] = "provider-sdk",
): DoctorIntegrationStep {
  const entry = entryForPackage(report, pkg);
  const targetFile = entry?.relativePath ?? syntheticEntryForPackage(pkg);
  const frontendish = /src\/main\.tsx$|src\/main\.jsx$|apps\/web\/|\/components\//i.test(targetFile);
  let status: DoctorIntegrationStep["status"] = pkg.hasSpectyraAutoImport ? "complete" : "pending";
  if (!pkg.hasSpectyraSdk) status = "blocked";
  if (frontendish && !pkg.hasSpectyraAutoImport) status = "warning";

  return {
    id: `add-auto-import:${track}:${pkg.packageDir}`,
    kind: "add-auto-import",
    status,
    priority: stepPriority(status, !pkg.hasSpectyraSdk),
    title: `Add Spectyra auto import in ${targetFile}`,
    summary: frontendish
      ? "Doctor found a frontend-looking entrypoint. Do not put API keys in browser code; add Spectyra to your backend/API layer."
      : "This enables automatic metadata capture and the SDK monitor bridge for supported Node HTTP paths.",
    targetFile,
    packageDir: pkg.packageDir,
    track,
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
    if (!isProviderFinding(f)) continue;
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
      const packageIntegrated = f.packageDir
        ? packageHasIntegrationEvidence(report, f.packageDir)
        : false;
      const status: DoctorIntegrationStep["status"] = localIntegrated ? "complete" : packageIntegrated ? "warning" : "pending";
      return {
        id: `wrap:${f.provider}:${target}:${f.line}`,
        kind: f.callStyle === "custom-wrapper" || /llm|ai|client|openai|anthropic|groq/i.test(target) ? "wrap-central-client" : "wrap-llm-call",
        status,
        priority: f.confidence >= 0.85 ? "high" : "medium",
        title: localIntegrated
          ? `Spectyra wrapper detected near ${f.relativePath}`
          : `Wrap ${f.provider} call in ${target}`,
        summary: `Detected ${f.callStyle} ${f.usageType} usage at ${f.relativePath}:${f.line}. Use this wrapper so Spectyra can optimize and monitor the call.`,
        targetFile: target,
        targetLine: f.line,
        packageDir: f.packageDir,
        provider: f.provider,
        usageType: f.usageType,
        callStyle: f.callStyle,
        track: "provider-sdk",
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

function pkgForFinding(report: DoctorScanReport, finding: AiUsageFinding): PackageFinding | undefined {
  const dir = finding.packageDir ?? ".";
  return report.packages.find((p) => p.packageDir === dir);
}

function uniquePackagesForFindings(report: DoctorScanReport, findings: AiUsageFinding[]): PackageFinding[] {
  const dirs = new Set(findings.map((f) => f.packageDir ?? "."));
  return report.packages.filter((p) => dirs.has(p.packageDir));
}

function cliWrapperStep(report: DoctorScanReport, finding: AiUsageFinding): DoctorIntegrationStep {
  const target = suggestedCliWrapperFile(finding, report.integrationPoints);
  const pkg = pkgForFinding(report, finding);
  const complete = finding.packageDir ? packageHasCliIntegrationEvidence(report, finding.packageDir) : SPECTYRA_CLI_INTEGRATION_RE.test(fileText(finding.filePath));
  const blocks = buildCliHarnessIntegrationBlocks(finding, report.integrationPoints);
  return {
    id: `cli-wrapper:${finding.packageDir ?? "."}:${finding.cliTool ?? "custom"}:${target}`,
    kind: "wrap-central-client",
    status: complete ? "complete" : pkg?.hasSpectyraSdk === false ? "blocked" : "pending",
    priority: "high",
    title: `Create ${cliToolTitle(finding)} wrapper`,
    summary:
      finding.cliTool === "claude"
        ? "This app invokes Claude through a CLI process instead of calling Anthropic SDK directly. Add Spectyra at the command boundary. This lets Spectyra monitor and optimize repeated prompts, retries, loops, oversized prompts, output size, duration, and cacheable CLI runs."
        : `This app invokes ${cliToolTitle(finding)} through a CLI process. Add Spectyra at the command boundary before the expensive CLI process starts.`,
    targetFile: target,
    packageDir: finding.packageDir,
    provider: finding.provider,
    usageType: finding.usageType,
    callStyle: "cli",
    track: "ai-cli-harness",
    modelHints: finding.modelHints,
    codeBlocks: blocks.filter((b) => /Create|Update existing harness file/.test(b.title)),
    verifyChecks: [
      `${target} imports from @spectyra/sdk/cli`,
      `${target} calls createClaudeCliHarness/createGeminiCliHarness/createCodexCliHarness/createCliHarness`,
      `${target} does not upload raw prompts or raw CLI output by default`,
    ],
    notes: [
      "Exact provider token/cost data may be estimated unless the CLI exposes structured usage metadata.",
      "Spectyra can still save by avoiding or optimizing CLI runs before they happen.",
    ],
    nextAction: complete ? "Replace any remaining raw CLI call sites." : `Create or update ${target}, then replace the raw CLI call sites.`,
  };
}

function cliReplacementStep(report: DoctorScanReport, finding: AiUsageFinding): DoctorIntegrationStep {
  const target = suggestedCliWrapperFile(finding, report.integrationPoints);
  const blocks = buildCliHarnessIntegrationBlocks(finding, report.integrationPoints);
  const replacementBlocks = blocks.filter((b) => /Replace raw CLI call|Streaming call-site replacement/.test(b.title));
  const rawStillPresent = !findingHasLocalIntegrationEvidence(finding);
  return {
    id: `cli-replace:${finding.relativePath}:${finding.line}:${finding.cliTool ?? finding.command ?? "custom"}`,
    kind: "wrap-llm-call",
    status: rawStillPresent ? "pending" : "complete",
    priority: finding.confidence >= 0.85 ? "high" : "medium",
    title: `Replace raw ${cliToolTitle(finding)} call in ${finding.relativePath}:${finding.line}`,
    summary: "Replace this raw AI CLI invocation with the Spectyra wrapper so command-boundary monitoring runs before the CLI starts.",
    targetFile: finding.relativePath,
    targetLine: finding.line,
    packageDir: finding.packageDir,
    provider: finding.provider,
    usageType: finding.usageType,
    callStyle: "cli",
    track: "ai-cli-harness",
    modelHints: finding.modelHints,
    codeBlocks: [
      {
        title: `Detected raw command at ${finding.relativePath}:${finding.line}`,
        language: "text",
        code: finding.snippet,
        copyLabel: "Copy detected raw command",
      },
      {
        title: "Wrapper file to create or update",
        language: "text",
        code: target,
        copyLabel: "Copy wrapper path",
      },
      ...replacementBlocks,
    ],
    verifyChecks: [
      `${finding.relativePath}:${finding.line} no longer calls ${finding.command ?? cliToolTitle(finding)} directly`,
      `${finding.relativePath} imports the run*WithSpectyra helper from the CLI harness wrapper`,
      "Raw AI CLI calls no longer remain outside src/lib/ai/*CliHarness.ts or src/ai/*Harness.ts",
    ],
    notes: [
      "This wraps the command boundary. Spectyra can monitor and optimize duplicate runs, retries, loops, prompt size, output size, and duration before the expensive CLI process runs.",
      finding.isStreaming ? "Streaming detected. Use the replacement that forwards chunks through onChunk/onStdout." : "",
    ].filter(Boolean),
    nextAction: `Replace the raw snippet with the generated ${cliToolTitle(finding)} wrapper call, then rescan Doctor.`,
  };
}

function cliRunVerifyStep(report: DoctorScanReport, findings: AiUsageFinding[]): DoctorIntegrationStep {
  const first = findings[0];
  const pkg = first ? pkgForFinding(report, first) : undefined;
  const packageDir = pkg?.packageDir;
  return {
    id: `cli-run-verify:${packageDir ?? "."}`,
    kind: "verify",
    status: "pending",
    priority: "medium",
    title: "Run the task, rescan, and verify CLI harness setup",
    summary: "Run the app or task that launches the AI CLI, then rescan Doctor to confirm the raw command is gone and the Spectyra CLI harness is present.",
    packageDir,
    track: "ai-cli-harness",
    codeBlocks: [
      {
        title: "Run and verify commands",
        language: "bash",
        copyLabel: "Copy run/rescan commands",
        code: `${packageDir && packageDir !== "." ? `cd ${packageDir}\n` : ""}npm run dev
spectyra-doctor scan
spectyra-doctor verify`,
      },
    ],
    verifyChecks: [
      "@spectyra/sdk is installed in the package that launches the CLI",
      '@spectyra/sdk/auto is imported where the task/server starts',
      "@spectyra/sdk/cli import and create*CliHarness helper are detected",
      "No raw AI CLI calls remain outside known wrapper files",
    ],
    notes: ["When ready, switch to the SDK monitor overlay or local companion to watch CLI harness events."],
    nextAction: "Run the workflow once, then rescan and open the SDK monitor/local companion.",
  };
}

function buildCliHarnessTrack(report: DoctorScanReport, cliFindings: AiUsageFinding[], readiness: Readiness): DoctorIntegrationTrack | undefined {
  if (!cliFindings.length) return undefined;
  const steps: DoctorIntegrationStep[] = [];
  for (const pkg of uniquePackagesForFindings(report, cliFindings)) {
    steps.push(installStep(pkg, "ai-cli-harness"));
    steps.push(autoImportStep(report, pkg, "ai-cli-harness"));
  }

  const byWrapper = new Map<string, AiUsageFinding>();
  for (const finding of cliFindings) {
    const key = `${finding.packageDir ?? "."}:${finding.cliTool ?? finding.command ?? "custom"}:${suggestedCliWrapperFile(finding, report.integrationPoints)}`;
    const prev = byWrapper.get(key);
    if (!prev || finding.confidence > prev.confidence) byWrapper.set(key, finding);
  }
  for (const finding of byWrapper.values()) steps.push(cliWrapperStep(report, finding));
  for (const finding of cliFindings.filter((f) => !isCliWrapperPath(f.relativePath))) steps.push(cliReplacementStep(report, finding));
  steps.push(cliRunVerifyStep(report, cliFindings));

  const tools = [...new Set(cliFindings.map((f) => cliToolTitle(f)))];
  const claudeOnly = tools.length === 1 && tools[0] === "Claude CLI";
  const persistentOnly = cliFindings.every(isPersistentCliFinding);
  return {
    id: "track:ai-cli-harness",
    kind: cliFindings.every(isPersistentCliFinding) ? "persistent-cli-session" : "ai-cli-harness",
    title: persistentOnly ? "Persistent AI CLI Session Integration" : claudeOnly ? "Claude CLI harness integration" : "AI CLI harness integration",
    summary:
      "Spectyra found AI calls made through command-line tools. Wrap the command boundary so Spectyra can monitor and optimize duplicate runs, retries, loops, prompt size, output size, and duration.",
    status: readiness.detail.cliHarnessStatus === "not-detected" ? "not-started" : readiness.detail.cliHarnessStatus,
    steps,
  };
}

function buildAcpTrack(acpFindings: AiUsageFinding[]): DoctorIntegrationTrack | undefined {
  if (!acpFindings.length) return undefined;
  const steps: DoctorIntegrationStep[] = acpFindings.map((finding) => ({
    id: `acp-review:${finding.relativePath}:${finding.line}`,
    kind: "wrap-central-client",
    status: "pending",
    priority: finding.confidence >= 0.85 ? "high" : "medium",
    title: `Review ACP harness at ${finding.relativePath}:${finding.line}`,
    summary: "Doctor found Agent Client Protocol evidence. Wrap the ACP session/prompt boundary with Spectyra once the ACP SDK helper is available for this project.",
    targetFile: finding.relativePath,
    targetLine: finding.line,
    packageDir: finding.packageDir,
    provider: finding.provider,
    usageType: finding.usageType,
    callStyle: "acp",
    track: "acp-harness",
    modelHints: finding.modelHints,
    codeBlocks: [
      {
        title: `Detected ACP evidence at ${finding.relativePath}:${finding.line}`,
        language: "text",
        code: finding.snippet,
        copyLabel: "Copy detected snippet",
      },
      {
        title: "ACP integration note",
        language: "text",
        code: "Install @spectyra/sdk, add import \"@spectyra/sdk/auto\" at the agent host entrypoint, then wrap the ACP session/prompt boundary when @spectyra/sdk/acp is available.",
        copyLabel: "Copy ACP note",
      },
    ],
    verifyChecks: ["ACP package/protocol methods are present", "Spectyra SDK is installed in the agent host package", "ACP prompt/session boundary has Spectyra wrapper evidence"],
    notes: ["Low-confidence ACP references are kept under Possible AI-related references and do not generate wrapper code."],
    nextAction: "Review the ACP host and add Spectyra at the session/prompt boundary.",
  }));
  return {
    id: "track:acp-harness",
    kind: "acp-harness",
    title: "ACP Harness Integration",
    summary: "Spectyra found Agent Client Protocol harness evidence. Integrate at the agent session or prompt boundary.",
    status: "in-progress",
    steps,
  };
}

function buildProviderTrack(report: DoctorScanReport, providerFindings: AiUsageFinding[], readiness: Readiness): DoctorIntegrationTrack | undefined {
  if (!providerFindings.length) return undefined;
  const steps: DoctorIntegrationStep[] = [];
  for (const pkg of uniquePackagesForFindings(report, providerFindings)) {
    steps.push(installStep(pkg, "provider-sdk"));
    steps.push(autoImportStep(report, pkg, "provider-sdk"));
  }
  steps.push(...wrapperSteps(report));
  return {
    id: "track:provider-sdk",
    kind: "provider-sdk",
    title: "Provider SDK/API integration",
    summary: "Spectyra found direct provider SDK/API calls. Wrap provider clients with Spectyra provider adapters and framework monitor hooks.",
    status: readiness.detail.providerSdkStatus === "not-detected" ? "not-started" : readiness.detail.providerSdkStatus,
    steps,
  };
}

function operationalSteps(readiness: Readiness): DoctorIntegrationStep[] {
  const runStep: DoctorIntegrationStep = {
    id: "run-app",
    kind: "run-app",
    status: readiness.status === "ready" ? "ready" : "pending",
    priority: "medium",
    title: "Run your app",
    track: "operations",
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
    track: "operations",
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
    track: "operations",
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
  const providerFindings = report.aiFindings.filter(isProviderFinding);
  const cliFindings = report.aiFindings.filter(isCliFinding);
  const acpFindings = report.aiFindings.filter(isAcpFinding);
  const tracks = [
    buildProviderTrack(report, providerFindings, readiness),
    buildCliHarnessTrack(report, cliFindings, readiness),
    buildAcpTrack(acpFindings),
  ].filter((track): track is DoctorIntegrationTrack => Boolean(track));
  const steps: DoctorIntegrationStep[] = tracks.flatMap((track) => track.steps);
  const ops = operationalSteps(readiness);
  const operationsTrack: DoctorIntegrationTrack = {
    id: "track:operations",
    kind: "operations",
    title: "Run, verify, and monitor",
    summary: "After code changes, run the app or task, rescan Doctor, verify static setup, then switch to the SDK monitor overlay or local companion.",
    status: readiness.status,
    steps: ops,
  };
  if (steps.length) tracks.push(operationsTrack);
  steps.push(...ops);

  const nextPending = steps.find((s) => s.status === "pending" || s.status === "blocked" || s.status === "warning");
  const hasProviderTrack = report.aiFindings.some(isProviderFinding);
  const hasCliTrack = report.aiFindings.some(isCliFinding);
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
        : `${readiness.score}% ready. ${hasProviderTrack ? "Provider SDK/API track detected. " : ""}${hasCliTrack ? "AI CLI harness track detected. " : ""}Complete the pending setup steps, rescan, then verify runtime events.`,
    score: readiness.score,
    blockers: readiness.blockers,
    completed: readiness.completed,
    tracks,
    steps,
    readyMessage,
    monitorNextSteps: ops.slice(-1),
    readiness: readiness.detail,
  };
}
