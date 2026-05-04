import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { discoverPackageManifests, nearestPackageDirForFile } from "./monorepo.js";
import type { PackageFinding, SpectyraStatus } from "./types.js";

function readPkgAt(projectRoot: string, manifestRel: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(`${projectRoot}/${manifestRel}`, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function depVersion(pkg: Record<string, unknown> | null, name: string): string | undefined {
  if (!pkg) return undefined;
  const d = (pkg.dependencies as Record<string, string>)?.[name];
  const dd = (pkg.devDependencies as Record<string, string>)?.[name];
  return d ?? dd;
}

const SDK_AUTO_RE =
  /@spectyra\/sdk\/auto|from\s+['"]@spectyra\/sdk\/auto['"]|require\s*\(\s*['"]@spectyra\/sdk\/auto['"]/;
const SDK_CLI_RE = /@spectyra\/sdk\/cli|createCliHarness\s*\(|createClaudeCliHarness\s*\(|createGeminiCliHarness\s*\(|createCodexCliHarness\s*\(/;
const SDK_ACP_RE = /@spectyra\/sdk\/acp|createAcpHarness\s*\(/;
const PROVIDER_WRAPPER_RE = /createSpectyra\s*\(|createOpenAIAdapter\s*\(|createAnthropicAdapter\s*\(|createGroqAdapter\s*\(|spectyra\.complete\s*\(/;
const LEGACY_AUTO_RE =
  /@spectyra\/auto|from\s+['"]@spectyra\/auto['"]|require\s*\(\s*['"]@spectyra\/auto['"]/;
const LEGACY_DEVTOOLS_RE = /@spectyra\/devtools|from\s+['"]@spectyra\/devtools/;

export interface ScanSpectyraContext {
  packages?: PackageFinding[];
}

export function scanSpectyra(projectRoot: string, files: string[], ctx: ScanSpectyraContext = {}): SpectyraStatus {
  const packages = ctx.packages ?? [];
  const manifestAbsPaths = discoverPackageManifests(projectRoot);

  const rootPkg = readPkgAt(projectRoot, "package.json");
  const legacyAutoPkgRoot = Boolean(depVersion(rootPkg, "@spectyra/auto"));
  const sdkAtRoot = Boolean(depVersion(rootPkg, "@spectyra/sdk"));
  const devtoolsInstalledRoot = Boolean(depVersion(rootPkg, "@spectyra/devtools"));
  const doctorInstalled = Boolean(depVersion(rootPkg, "@spectyra/doctor"));

  const sdkInstalled = packages.length > 0 ? packages.some((p) => p.hasSpectyraSdk) : sdkAtRoot;

  const sdkAutoImportFiles: string[] = [];
  const sdkCliImportFiles: string[] = [];
  const sdkAcpImportFiles: string[] = [];
  const providerWrapperFiles: string[] = [];
  const cliWrapperFiles: string[] = [];
  const acpWrapperFiles: string[] = [];
  const legacyAutoImportFiles: string[] = [];
  const devtoolsImportFiles: string[] = [];
  let hasDevBridge = false;
  let hasStartSpectyraAuto = false;
  let possibleLateImport = false;

  const entryContent = new Map<string, string>();
  for (const abs of files) {
    const rel = relative(projectRoot, abs).replace(/\\/g, "/");
    try {
      entryContent.set(rel, readFileSync(abs, "utf8"));
    } catch {
      /* skip */
    }
  }

  for (const [rel, c] of entryContent) {
    if (SDK_AUTO_RE.test(c)) sdkAutoImportFiles.push(rel);
    if (SDK_CLI_RE.test(c)) {
      sdkCliImportFiles.push(rel);
      cliWrapperFiles.push(rel);
    }
    if (SDK_ACP_RE.test(c)) {
      sdkAcpImportFiles.push(rel);
      acpWrapperFiles.push(rel);
    }
    if (PROVIDER_WRAPPER_RE.test(c)) providerWrapperFiles.push(rel);
    if (LEGACY_AUTO_RE.test(c)) legacyAutoImportFiles.push(rel);
    if (LEGACY_DEVTOOLS_RE.test(c)) devtoolsImportFiles.push(rel);
    if (/useSpectyraAutoDevBridge|createSpectyraDevBridgeConnectMiddleware|registerSpectyraDevBridgeFastify/.test(c)) {
      hasDevBridge = true;
    }
    if (/startSpectyraAuto\s*\(/.test(c)) {
      hasStartSpectyraAuto = true;
    }
  }

  const devtoolsInstalledResolved =
    packages.length > 0
      ? packages.some((p) => p.hasLegacySpectyraDevtools) || devtoolsImportFiles.length > 0
      : devtoolsInstalledRoot || devtoolsImportFiles.length > 0;

  const autoImportFiles = [...new Set([...sdkAutoImportFiles, ...legacyAutoImportFiles])];

  const issues: string[] = [];
  const info: string[] = [];

  function legacyAutoInPackage(packageDir: string): boolean {
    return legacyAutoImportFiles.some((f) => nearestPackageDirForFile(join(projectRoot, f), projectRoot, manifestAbsPaths) === packageDir);
  }

  if (packages.length > 0) {
    for (const p of packages) {
      if (p.aiFindingCount === 0) continue;
      if (!p.hasSpectyraSdk) {
        issues.push(
          `@spectyra/sdk not listed in ${p.packageDir === "." ? "workspace root package.json" : `${p.packageDir}/package.json`}`,
        );
      } else if (!p.hasSpectyraAutoImport && !legacyAutoInPackage(p.packageDir)) {
        issues.push(
          `No @spectyra/sdk/auto import found in scanned sources for ${p.packageDir === "." ? "workspace root" : p.packageDir}`,
        );
      }
    }
  } else {
    if (!sdkAtRoot) issues.push("@spectyra/sdk not listed in package.json");
    if (sdkAtRoot && sdkAutoImportFiles.length === 0 && legacyAutoImportFiles.length === 0) {
      issues.push("No @spectyra/sdk/auto import found in scanned sources");
    }
  }

  if (legacyAutoPkgRoot || legacyAutoImportFiles.length > 0 || packages.some((p) => p.hasLegacySpectyraAuto)) {
    info.push("Legacy @spectyra/auto detected — migrate to import '@spectyra/sdk/auto'");
  }
  if (devtoolsImportFiles.length > 0 || packages.some((p) => p.hasLegacySpectyraDevtools)) {
    info.push("Legacy @spectyra/devtools import — prefer `import '@spectyra/sdk/auto'` (overlay is included)");
  }

  const mainCandidates = ["apps/api/src/main.ts", "src/main.ts", "src/index.ts", "main.ts", "index.ts"];
  const mainFile = mainCandidates.find((m) => entryContent.has(m));
  if (mainFile) {
    const body = entryContent.get(mainFile)!;
    const firstImport = body.search(/^\s*import\s/m);
    const spectyraIdx = body.search(/@spectyra\/sdk\/auto|@spectyra\/auto|startSpectyraAuto/);
    if (spectyraIdx >= 0 && firstImport >= 0 && spectyraIdx > firstImport + 400) {
      possibleLateImport = true;
      issues.push("Spectyra may load after other imports — consider moving to the very top or using node --import");
    }
  }

  return {
    autoInstalled: legacyAutoPkgRoot || legacyAutoImportFiles.length > 0,
    sdkInstalled,
    devtoolsInstalled: devtoolsInstalledResolved,
    doctorInstalled,
    legacyAutoImportFiles,
    sdkAutoImportFiles,
    sdkCliImportFiles,
    sdkAcpImportFiles,
    providerWrapperFiles,
    cliWrapperFiles,
    acpWrapperFiles,
    devtoolsImportFiles,
    autoImportFiles,
    hasDevBridge,
    hasStartSpectyraAuto,
    possibleLateImport,
    issues,
    info,
  };
}
