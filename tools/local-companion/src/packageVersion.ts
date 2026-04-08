import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cached: string | null = null;

export function companionPackageVersion(): string {
  if (cached) return cached;
  if (typeof __SPECTYRA_COMPANION_VERSION__ === "string" && __SPECTYRA_COMPANION_VERSION__.length > 0) {
    cached = __SPECTYRA_COMPANION_VERSION__;
    return cached;
  }
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(dir, "..", "package.json");
    const p = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version?: string };
    cached = typeof p.version === "string" ? p.version : "unknown";
  } catch {
    cached = "unknown";
  }
  return cached;
}
