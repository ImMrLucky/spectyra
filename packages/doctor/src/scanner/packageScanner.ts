import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { DoctorScanResult } from "./types.js";

export function detectPackageManager(projectRoot: string): DoctorScanResult["packageManager"] {
  if (existsSync(join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(projectRoot, "yarn.lock"))) return "yarn";
  if (existsSync(join(projectRoot, "bun.lockb")) || existsSync(join(projectRoot, "bun.lock"))) return "bun";
  if (existsSync(join(projectRoot, "package-lock.json"))) return "npm";
  return "unknown";
}

export function readRootPackageJson(projectRoot: string): Record<string, unknown> | null {
  const p = join(projectRoot, "package.json");
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function detectProjectType(projectRoot: string): DoctorScanResult["projectType"] {
  const hasPkg = existsSync(join(projectRoot, "package.json"));
  const hasPy =
    existsSync(join(projectRoot, "pyproject.toml")) ||
    existsSync(join(projectRoot, "requirements.txt")) ||
    existsSync(join(projectRoot, "setup.py"));
  if (hasPkg && hasPy) return "mixed";
  if (hasPkg) return "node";
  if (hasPy) return "python";
  return "unknown";
}

export function getDependencies(pkg: Record<string, unknown> | null): {
  deps: Record<string, string>;
  devDeps: Record<string, string>;
} {
  if (!pkg) return { deps: {}, devDeps: {} };
  const deps = (pkg.dependencies as Record<string, string>) ?? {};
  const devDeps = (pkg.devDependencies as Record<string, string>) ?? {};
  return { deps, devDeps };
}
