import { readFileSync } from "node:fs";
import fg from "fast-glob";
import { dirname, relative } from "node:path";
import type { DoctorScanReport, PackageFinding } from "./types.js";

const PKG_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.git/**",
  "**/.next/**",
  "**/coverage/**",
];

export function discoverPackageManifests(projectRoot: string): string[] {
  const posixRoot = projectRoot.replace(/\\/g, "/");
  return fg.sync(["**/package.json"], {
    cwd: posixRoot,
    absolute: true,
    onlyFiles: true,
    ignore: PKG_IGNORE,
    followSymbolicLinks: false,
    dot: false,
  });
}

function readJson(path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const AI_DEP_HINTS = [
  "openai",
  "@anthropic-ai/sdk",
  "groq-sdk",
  "@google/generative-ai",
  "@google/genai",
  "@azure/openai",
  "@aws-sdk/client-bedrock-runtime",
  "langchain",
  "@langchain/",
  "llamaindex",
  "ai",
  "@ai-sdk/",
  "ollama",
  "cohere-ai",
  "@mistralai/mistralai",
  "litellm",
  "anthropic",
  "replicate",
  "@huggingface/inference",
];

export function buildPackageFindings(projectRoot: string, manifestAbsPaths: string[]): PackageFinding[] {
  const posixRoot = projectRoot.replace(/\\/g, "/");
  const out: PackageFinding[] = [];
  for (const abs of manifestAbsPaths) {
    const pkgJsonRel = relative(posixRoot, abs).replace(/\\/g, "/");
    const packageDirRaw = dirname(pkgJsonRel).replace(/\\/g, "/");
    const packageDir = packageDirRaw === "." || packageDirRaw === "" ? "." : packageDirRaw;
    const pkg = readJson(abs);
    if (!pkg) continue;
    const name = typeof pkg.name === "string" ? pkg.name : undefined;
    const deps = { ...(pkg.dependencies as Record<string, string>), ...(pkg.devDependencies as Record<string, string>) };
    const hasSpectyraSdk = Boolean(deps["@spectyra/sdk"]);
    const hasLegacySpectyraAuto = Boolean(deps["@spectyra/auto"]);
    const hasLegacySpectyraDevtools = Boolean(deps["@spectyra/devtools"]);
    const aiDependencyHints = AI_DEP_HINTS.filter((k) =>
      Object.keys(deps).some((d) => d === k || d.startsWith(`${k}/`) || d.includes(k.replace(/\*$/, ""))),
    );
    out.push({
      packageDir,
      relativePath: packageDir,
      manifestPath: pkgJsonRel,
      name,
      packageManager: "unknown",
      hasSpectyraSdk,
      hasSpectyraAutoImport: false,
      hasLegacySpectyraAuto,
      hasLegacySpectyraDevtools,
      aiDependencyHints,
      aiFindingCount: 0,
      installCommand: "",
    });
  }
  return out.sort((a, b) => a.manifestPath.localeCompare(b.manifestPath));
}

/** pnpm: `pnpm --filter <name> add …` (workspace-safe). */
export function computeSdkInstallCommand(
  pm: DoctorScanReport["packageManager"] | undefined,
  p: PackageFinding,
): string {
  if (p.hasSpectyraSdk) return "";
  const filter = p.name && p.name.length > 0 ? p.name : p.packageDir === "." ? "." : p.packageDir;
  if (pm === "pnpm") return `pnpm --filter ${filter} add @spectyra/sdk`;
  const dir = p.packageDir === "." ? "." : p.packageDir;
  if (pm === "yarn") return `cd ${dir} && yarn add @spectyra/sdk`;
  if (pm === "bun") return `cd ${dir} && bun add @spectyra/sdk`;
  return `cd ${dir} && npm install @spectyra/sdk`;
}

export function applyPackageScanStats(
  packages: PackageFinding[],
  aiFindings: import("./types.js").AiUsageFinding[],
  pm: DoctorScanReport["packageManager"],
): void {
  for (const p of packages) {
    p.aiFindingCount = aiFindings.filter((f) => f.packageDir === p.packageDir).length;
    p.packageManager = pm === "unknown" || !pm ? "unknown" : pm;
    p.installCommand = computeSdkInstallCommand(pm, p);
  }
}

/** Directory (relative to project root) containing the nearest package.json for a file. */
export function nearestPackageDirForFile(fileAbs: string, projectRoot: string, manifestAbsPaths: string[]): string {
  const normFile = fileAbs.replace(/\\/g, "/");
  const normRoot = projectRoot.replace(/\\/g, "/");
  let best = ".";
  let bestLen = -1;
  for (const man of manifestAbsPaths) {
    const pkgDir = dirname(man).replace(/\\/g, "/");
    if (normFile.startsWith(pkgDir + "/") || normFile === pkgDir) {
      if (pkgDir.length > bestLen) {
        bestLen = pkgDir.length;
        const rel = relative(normRoot, pkgDir).replace(/\\/g, "/");
        best = rel && rel !== "" ? rel : ".";
      }
    }
  }
  return best;
}

export function applySdkAutoFlags(packages: PackageFinding[], projectRoot: string, fileAbsPaths: string[]): void {
  const manifests = discoverPackageManifests(projectRoot);
  const sdkAutoRel = new Set<string>();
  for (const abs of fileAbsPaths) {
    let body: string;
    try {
      body = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    if (/@spectyra\/sdk\/auto|from\s+['"]@spectyra\/sdk\/auto['"]/.test(body)) {
      sdkAutoRel.add(nearestPackageDirForFile(abs, projectRoot, manifests));
    }
  }
  for (const p of packages) {
    if (sdkAutoRel.has(p.packageDir)) p.hasSpectyraAutoImport = true;
  }
}
