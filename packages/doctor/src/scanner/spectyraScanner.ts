import { readFileSync } from "node:fs";
import { relative } from "node:path";
import type { SpectyraStatus } from "./types.js";

function readPkg(projectRoot: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(`${projectRoot}/package.json`, "utf8")) as Record<string, unknown>;
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
const LEGACY_AUTO_RE =
  /@spectyra\/auto|from\s+['"]@spectyra\/auto['"]|require\s*\(\s*['"]@spectyra\/auto['"]/;
const LEGACY_DEVTOOLS_RE = /@spectyra\/devtools|from\s+['"]@spectyra\/devtools/;

export function scanSpectyra(projectRoot: string, files: string[]): SpectyraStatus {
  const pkg = readPkg(projectRoot);
  const legacyAutoPkg = Boolean(depVersion(pkg, "@spectyra/auto"));
  const sdkInstalled = Boolean(depVersion(pkg, "@spectyra/sdk"));
  const devtoolsInstalled = Boolean(depVersion(pkg, "@spectyra/devtools"));
  const doctorInstalled = Boolean(depVersion(pkg, "@spectyra/doctor"));

  const sdkAutoImportFiles: string[] = [];
  const legacyAutoImportFiles: string[] = [];
  const devtoolsImportFiles: string[] = [];
  let hasDevBridge = false;
  let hasStartSpectyraAuto = false;
  let possibleLateImport = false;

  const entryContent = new Map<string, string>();
  for (const abs of files) {
    const rel = relative(projectRoot, abs).replace(/\\/g, "/");
    try {
      const c = readFileSync(abs, "utf8");
      entryContent.set(rel, c);
    } catch {
      /* skip */
    }
  }

  for (const [rel, c] of entryContent) {
    if (SDK_AUTO_RE.test(c)) {
      sdkAutoImportFiles.push(rel);
    }
    if (LEGACY_AUTO_RE.test(c)) {
      legacyAutoImportFiles.push(rel);
    }
    if (LEGACY_DEVTOOLS_RE.test(c)) {
      devtoolsImportFiles.push(rel);
    }
    if (/useSpectyraAutoDevBridge|createSpectyraDevBridgeConnectMiddleware|registerSpectyraDevBridgeFastify/.test(c)) {
      hasDevBridge = true;
    }
    if (/startSpectyraAuto\s*\(/.test(c)) {
      hasStartSpectyraAuto = true;
    }
  }

  const autoImportFiles = [...new Set([...sdkAutoImportFiles, ...legacyAutoImportFiles])];

  const issues: string[] = [];
  const info: string[] = [];
  if (!sdkInstalled) issues.push("@spectyra/sdk not listed in package.json");
  if (sdkInstalled && sdkAutoImportFiles.length === 0 && legacyAutoImportFiles.length === 0) {
    issues.push("No @spectyra/sdk/auto import found in scanned sources");
  }
  if (legacyAutoPkg || legacyAutoImportFiles.length > 0) {
    info.push("Legacy @spectyra/auto detected — migrate to import '@spectyra/sdk/auto'");
  }
  if (devtoolsImportFiles.length > 0) {
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
    autoInstalled: legacyAutoPkg || legacyAutoImportFiles.length > 0,
    sdkInstalled,
    devtoolsInstalled,
    doctorInstalled,
    legacyAutoImportFiles,
    sdkAutoImportFiles,
    devtoolsImportFiles,
    autoImportFiles,
    hasDevBridge,
    hasStartSpectyraAuto,
    possibleLateImport,
    issues,
    info,
  };
}
