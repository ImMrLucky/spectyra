import { normalizeProjectRoot } from "../utils/paths.js";
import { scanAllAiCalls } from "./aiCallScanner.js";
import { detectEntrypoints } from "./entrypointScanner.js";
import { detectFrameworks } from "./frameworkScanner.js";
import {
  detectPackageManager,
  detectProjectType,
  getDependencies,
  readRootPackageJson,
} from "./packageScanner.js";
import { mergeProviders, scanTextForProviders } from "./providerScanner.js";
import { buildRecommendations } from "./recommendationEngine.js";
import { scanSpectyra } from "./spectyraScanner.js";
import type { DoctorScanResult, DoctorWarning, ScanProgressFn, UserPlacementAnswer } from "./types.js";
import { walkSourceFiles } from "./fileWalker.js";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

export async function runScan(
  projectRootRaw: string,
  options: { onProgress?: ScanProgressFn; userPlacement?: UserPlacementAnswer } = {},
): Promise<DoctorScanResult> {
  const projectRoot = normalizeProjectRoot(projectRootRaw);
  const on = options.onProgress ?? (() => {});

  on({ type: "progress", message: `Project: ${projectRoot}` });

  on({ type: "progress", message: "Scanning package.json…" });
  const pkg = readRootPackageJson(projectRoot);
  const { deps, devDeps } = getDependencies(pkg);
  const packageManager = detectPackageManager(projectRoot);
  const projectType = detectProjectType(projectRoot);

  on({ type: "finding", message: `Detected package manager: ${packageManager}`, data: { packageManager } });

  on({ type: "progress", message: "Walking source files…" });
  const files = await walkSourceFiles(projectRoot);
  on({ type: "finding", message: `Scanned ${files.length} files`, data: { count: files.length } });

  on({ type: "progress", message: "Detecting frameworks…" });
  const frameworks = detectFrameworks(deps, devDeps);
  for (const f of frameworks) {
    on({ type: "finding", message: `Framework: ${f.id}`, data: f });
  }

  on({ type: "progress", message: "Detecting entrypoints…" });
  const entrypoints = detectEntrypoints(projectRoot, { ...devDeps, ...deps });

  on({ type: "progress", message: "Scanning providers & AI call sites…" });
  const providerRows: ReturnType<typeof scanTextForProviders>[] = [];
  for (const abs of files) {
    let content: string;
    try {
      content = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    const rel = relative(projectRoot, abs).replace(/\\/g, "/");
    providerRows.push(scanTextForProviders(content, rel));
  }
  const providers = mergeProviders(providerRows);

  const aiCallSites = scanAllAiCalls(projectRoot, files);
  for (const site of aiCallSites.slice(0, 20)) {
    on({ type: "finding", message: `${site.file}${site.line ? `:${site.line}` : ""} — ${site.kind}`, data: site });
  }

  on({ type: "progress", message: "Checking Spectyra integration…" });
  const spectyraStatus = scanSpectyra(projectRoot, files);

  const warnings: DoctorWarning[] = [];
  if (spectyraStatusIssues(spectyraStatus)) {
    warnings.push({
      code: "spectyra-missing",
      message: "Spectyra packages or imports not fully detected",
      severity: "warn",
    });
    on({ type: "warning", message: warnings[warnings.length - 1]!.message });
  }
  if (
    aiCallSites.length &&
    (!spectyraStatus.sdkInstalled ||
      (spectyraStatus.sdkInstalled &&
        spectyraStatus.sdkAutoImportFiles.length === 0 &&
        spectyraStatus.legacyAutoImportFiles.length === 0))
  ) {
    warnings.push({
      code: "ai-without-sdk-auto",
      message:
        "AI patterns found but `import '@spectyra/sdk/auto'` is not detected (or @spectyra/sdk is missing from package.json)",
      severity: "warn",
    });
    on({ type: "warning", message: warnings[warnings.length - 1]!.message });
  }

  const base: DoctorScanResult = {
    projectRoot,
    packageManager,
    projectType,
    frameworks,
    providers,
    aiCallSites,
    entrypoints,
    spectyraStatus,
    recommendations: [],
    warnings,
    userPlacement: options.userPlacement ?? "not_sure",
  };

  base.recommendations = buildRecommendations(base);
  on({ type: "result", message: "Scan complete", data: base });
  return base;
}

function spectyraStatusIssues(s: DoctorScanResult["spectyraStatus"]): boolean {
  return s.issues.length > 0;
}

export type { DoctorScanResult, UserPlacementAnswer } from "./types.js";
