import { normalizeProjectRoot } from "../utils/paths.js";
import { detectEntrypoints } from "./entrypointScanner.js";
import { detectFrameworks } from "./frameworkScanner.js";
import {
  detectPackageManager,
  detectProjectType,
  getDependencies,
  readRootPackageJson,
} from "./packageScanner.js";
import { mergeProviders, scanTextForProviders } from "./providerScanner.js";
import { scanSpectyra } from "./spectyraScanner.js";
import type { DoctorFileWalkSummary, DoctorScanResult, DoctorWarning, ScanProgressFn, UserPlacementAnswer } from "./types.js";
import { walkProjectTree } from "./fileWalker.js";
import { readFileSync } from "node:fs";
import { discoverPackageManifests, buildPackageFindings, applySdkAutoFlags, applyPackageScanStats } from "./monorepo.js";
import { scanAiUsage, findingsToAiCallSites } from "./aiUsageScanner.js";
import { scanIntegrationPoints, primaryEntryFromPoints } from "./integrationPointScanner.js";
import { buildTopRecommendations } from "../recommendations/topRecommendations.js";
import { buildDoctorRisks } from "./risks.js";

export async function runScan(
  projectRootRaw: string,
  options: {
    onProgress?: ScanProgressFn;
    userPlacement?: UserPlacementAnswer;
    maxFileSizeBytes?: number;
    followSymlinks?: boolean;
  } = {},
): Promise<DoctorScanResult> {
  const projectRoot = normalizeProjectRoot(projectRootRaw);
  const on = options.onProgress ?? (() => {});

  on({ type: "progress", message: `Project: ${projectRoot}` });

  on({ type: "progress", message: "Reading package manifests…" });
  const pkg = readRootPackageJson(projectRoot);
  const { deps, devDeps } = getDependencies(pkg);
  const packageManager = detectPackageManager(projectRoot);
  const projectType = detectProjectType(projectRoot);
  const manifestAbs = discoverPackageManifests(projectRoot);
  const packages = buildPackageFindings(projectRoot, manifestAbs);

  on({ type: "finding", message: `Package manager: ${packageManager}`, data: { packageManager } });

  on({ type: "progress", message: "Walking project files…" });
  const walk = await walkProjectTree({
    rootDir: projectRoot,
    maxFileSizeBytes: options.maxFileSizeBytes,
    followSymlinks: options.followSymlinks,
  });
  const scannedFiles = walk.files;
  const filePaths = scannedFiles.map((f) => f.path);

  const warnings: DoctorWarning[] = [];
  for (const w of walk.walkWarnings.slice(0, 50)) {
    warnings.push({ code: "file-walk", message: w, severity: "warn" });
  }

  const skippedByReason: Record<string, number> = {};
  for (const s of walk.skipped) {
    skippedByReason[s.reason] = (skippedByReason[s.reason] ?? 0) + 1;
  }
  const permissionOrReadErrors = (skippedByReason["permission-error"] ?? 0) + (skippedByReason["read-error"] ?? 0);
  const fileWalk: DoctorFileWalkSummary = {
    rootDir: walk.rootDir,
    directoriesSkipped: walk.directoriesSkipped,
    skippedTotal: walk.skipped.length,
    skippedByReason,
    skippedSample: walk.skipped.slice(0, 200).map((s) => ({
      relativePath: s.relativePath,
      reason: s.reason,
      detail: s.detail,
    })),
    permissionOrReadErrors,
    walkWarnings: walk.walkWarnings.slice(0, 80),
  };

  applySdkAutoFlags(packages, projectRoot, filePaths);

  on({
    type: "finding",
    message: `Files to analyze: ${scannedFiles.length} (${walk.skipped.length} skipped, ${walk.directoriesSkipped.length} directories not descended)`,
    data: { count: scannedFiles.length, skipped: walk.skipped.length, dirsSkipped: walk.directoriesSkipped.length },
  });

  on({ type: "progress", message: "Detecting frameworks…" });
  const frameworks = detectFrameworks(deps, devDeps);
  for (const f of frameworks) on({ type: "finding", message: `Framework: ${f.id}`, data: f });

  on({ type: "progress", message: "Detecting entrypoints…" });
  const entrypoints = detectEntrypoints(projectRoot, { ...devDeps, ...deps });

  on({ type: "progress", message: "Scanning provider hints in files…" });
  const providerRows: ReturnType<typeof scanTextForProviders>[] = [];
  let providerReadFailures = 0;
  for (const sf of scannedFiles) {
    let content: string;
    try {
      content = readFileSync(sf.path, "utf8");
    } catch (e) {
      if (providerReadFailures < 30) {
        warnings.push({
          code: "file-read",
          message: `Could not read ${sf.relativePath}: ${e instanceof Error ? e.message : String(e)}`,
          severity: "warn",
          file: sf.relativePath,
        });
      }
      providerReadFailures++;
      continue;
    }
    providerRows.push(scanTextForProviders(content, sf.relativePath));
  }
  const providers = mergeProviders(providerRows);

  const integrationPointsPre = scanIntegrationPoints(projectRoot, []);
  const primaryEntry = primaryEntryFromPoints(integrationPointsPre);

  on({ type: "progress", message: "Detecting AI usage…" });
  const aiFindings = scanAiUsage(projectRoot, scannedFiles, { primaryEntry, manifestAbsPaths: manifestAbs });
  for (const f of aiFindings.slice(0, 25)) {
    on({ type: "finding", message: `${f.relativePath}:${f.line} — ${f.provider} (${f.callStyle})`, data: f });
  }

  applyPackageScanStats(packages, aiFindings, packageManager);

  const integrationPoints = scanIntegrationPoints(projectRoot, aiFindings);
  const spectyraStatus = scanSpectyra(projectRoot, filePaths, { packages });

  const aiCallSites = findingsToAiCallSites(aiFindings);

  if (spectyraStatus.issues.length > 0) {
    warnings.push({
      code: "spectyra-missing",
      message: "Spectyra packages or imports need attention in scanned packages",
      severity: "warn",
    });
    on({ type: "warning", message: warnings[warnings.length - 1]!.message });
  }
  if (
    aiFindings.length &&
    (!spectyraStatus.sdkInstalled ||
      (spectyraStatus.sdkInstalled &&
        spectyraStatus.sdkAutoImportFiles.length === 0 &&
        spectyraStatus.legacyAutoImportFiles.length === 0))
  ) {
    warnings.push({
      code: "ai-without-sdk-auto",
      message:
        "AI usage detected but `import '@spectyra/sdk/auto'` is not found (or `@spectyra/sdk` is missing in package.json).",
      severity: "warn",
    });
    on({ type: "warning", message: warnings[warnings.length - 1]!.message });
  }

  const providerCounts: Record<string, number> = {};
  const usageCounts: Record<string, number> = {};
  const models = new Set<string>();
  const pkgUse = new Set<string>();
  for (const f of aiFindings) {
    providerCounts[f.provider] = (providerCounts[f.provider] ?? 0) + 1;
    usageCounts[f.usageType] = (usageCounts[f.usageType] ?? 0) + 1;
    f.modelHints.forEach((m) => models.add(m));
    if (f.packageDir) pkgUse.add(f.packageDir);
  }

  const scannedAt = new Date().toISOString();
  const highConfidence = aiFindings.filter((f) => f.confidence >= 0.8).length;

  const actionableSet = new Set<string>();
  for (const f of aiFindings) actionableSet.add(f.relativePath);
  for (const p of integrationPoints) actionableSet.add(p.relativePath);
  const actionableFilePaths = [...actionableSet].sort((a, b) => a.localeCompare(b));

  const report: DoctorScanResult = {
    projectRoot,
    scannedAt,
    packageManager,
    projectType,
    summary: {
      filesScanned: scannedFiles.length,
      filesSkipped: walk.skipped.length,
      directoriesSkipped: walk.directoriesSkipped.length,
      symlinksSkipped: skippedByReason.symlink ?? 0,
      secretFilesSkipped: skippedByReason["secret-file"] ?? 0,
      binariesSkipped: skippedByReason["binary-file"] ?? 0,
      oversizedSkipped: skippedByReason["oversized-file"] ?? 0,
      lockfilesSkipped: skippedByReason.lockfile ?? 0,
      permissionOrReadWarnings: permissionOrReadErrors + providerReadFailures,
      aiFindings: aiFindings.length,
      highConfidenceFindings: highConfidence,
      providers: providerCounts,
      usageTypes: usageCounts,
      modelsDetected: [...models].slice(0, 40),
      packagesWithAiUsage: [...pkgUse],
      spectyraInstalled: packages.some((p) => p.hasSpectyraSdk),
      spectyraAutoDetected: packages.some((p) => p.hasSpectyraAutoImport),
      recommendedNextStep:
        aiFindings.length === 0
          ? "No strong AI signals — add LLM code or widen scan paths."
          : !packages.some((p) => p.hasSpectyraSdk)
            ? "Install @spectyra/sdk in the package that owns LLM calls."
            : "Add `import \"@spectyra/sdk/auto\"` at your Node server entrypoint.",
    },
    packages,
    actionableFilePaths,
    aiFindings,
    integrationPoints,
    recommendations: [],
    risks: [],
    frameworks,
    providers,
    entrypoints,
    spectyraStatus,
    warnings,
    userPlacement: options.userPlacement ?? "not_sure",
    aiCallSites,
    fileWalk,
  };

  report.risks = buildDoctorRisks(report, spectyraStatus);
  report.recommendations = buildTopRecommendations(report);


  on({ type: "result", message: "Scan complete", data: report });
  return report;
}

export type { DoctorScanResult, UserPlacementAnswer } from "./types.js";
