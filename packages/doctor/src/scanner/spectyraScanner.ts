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

export function scanSpectyra(projectRoot: string, files: string[]): SpectyraStatus {
  const pkg = readPkg(projectRoot);
  const autoInstalled = Boolean(depVersion(pkg, "@spectyra/auto"));
  const sdkInstalled = Boolean(depVersion(pkg, "@spectyra/sdk"));
  const devtoolsInstalled = Boolean(depVersion(pkg, "@spectyra/devtools"));
  const doctorInstalled = Boolean(depVersion(pkg, "@spectyra/doctor"));

  const autoImportFiles: string[] = [];
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
    if (/@spectyra\/auto|from\s+['"]@spectyra\/auto['"]|require\s*\(\s*['"]@spectyra\/auto['"]/.test(c)) {
      autoImportFiles.push(rel);
    }
    if (/@spectyra\/devtools|from\s+['"]@spectyra\/devtools/.test(c)) {
      devtoolsImportFiles.push(rel);
    }
    if (/useSpectyraAutoDevBridge|createSpectyraDevBridgeConnectMiddleware|registerSpectyraDevBridgeFastify/.test(c)) {
      hasDevBridge = true;
    }
    if (/startSpectyraAuto\s*\(/.test(c)) {
      hasStartSpectyraAuto = true;
    }
  }

  const issues: string[] = [];
  if (!autoInstalled) issues.push("@spectyra/auto not listed in package.json");
  if (autoInstalled && autoImportFiles.length === 0) issues.push("No @spectyra/auto import found in scanned sources");

  const mainCandidates = ["apps/api/src/main.ts", "src/main.ts", "src/index.ts", "main.ts", "index.ts"];
  const mainFile = mainCandidates.find((m) => entryContent.has(m));
  if (mainFile) {
    const body = entryContent.get(mainFile)!;
    const firstImport = body.search(/^\s*import\s/m);
    const spectyraIdx = body.search(/@spectyra\/auto|startSpectyraAuto/);
    if (spectyraIdx >= 0 && firstImport >= 0 && spectyraIdx > firstImport + 400) {
      possibleLateImport = true;
      issues.push("Spectyra may load after other imports — consider moving to the very top or using node --import");
    }
  }

  return {
    autoInstalled,
    sdkInstalled,
    devtoolsInstalled,
    doctorInstalled,
    autoImportFiles,
    devtoolsImportFiles,
    hasDevBridge,
    hasStartSpectyraAuto,
    possibleLateImport,
    issues,
  };
}
