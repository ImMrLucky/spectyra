#!/usr/bin/env node
/**
 * Publish a Spectyra workspace package with **npm** while keeping `workspace:^…`
 * in source control for local monorepo installs.
 *
 * npm does not rewrite `workspace:` dependency specs in the published tarball
 * the way pnpm publish does, so consumers would otherwise see invalid specs.
 *
 * Usage (from the package directory, e.g. packages/sdk):
 *   npm run publish:npm -- --dry-run
 *   npm run publish:npm -- --access public
 *
 * Or:
 *   node ../../tools/npm-publish-spectyra.mjs
 *
 * Requires every `@spectyra/*` **runtime** dependency to already exist on the
 * registry at a version satisfying the range after `workspace:` is stripped
 * (e.g. workspace:^0.1.0 → ^0.1.0).
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const pkgDir = resolve(process.cwd());
const pkgPath = resolve(pkgDir, "package.json");
const bakPath = resolve(pkgDir, "package.json.publish.bak");
const npmArgs = process.argv.slice(2);

const DEP_KEYS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

function stripWorkspaceProtocol(spec) {
  if (typeof spec !== "string") return spec;
  if (!spec.startsWith("workspace:")) return spec;
  return spec.slice("workspace:".length);
}

function rewriteDeps(pkg) {
  const out = JSON.parse(JSON.stringify(pkg));
  for (const k of DEP_KEYS) {
    const block = out[k];
    if (!block || typeof block !== "object") continue;
    for (const name of Object.keys(block)) {
      out[k][name] = stripWorkspaceProtocol(block[name]);
    }
  }
  return out;
}

function main() {
  if (!existsSync(pkgPath)) {
    console.error(`No package.json at ${pkgPath}`);
    process.exit(1);
  }

  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw);
  const needsRewrite = DEP_KEYS.some((k) => {
    const b = pkg[k];
    if (!b) return false;
    return Object.values(b).some((v) => typeof v === "string" && v.startsWith("workspace:"));
  });

  if (!needsRewrite) {
    const r = spawnSync("npm", ["publish", ...npmArgs], { stdio: "inherit", cwd: pkgDir });
    process.exit(r.status ?? 1);
  }

  writeFileSync(bakPath, raw, "utf8");
  try {
    writeFileSync(pkgPath, JSON.stringify(rewriteDeps(pkg), null, 2) + "\n", "utf8");
    const r = spawnSync("npm", ["publish", ...npmArgs], { stdio: "inherit", cwd: pkgDir });
    if (r.status !== 0) process.exit(r.status ?? 1);
  } finally {
    try {
      if (existsSync(bakPath)) {
        const restored = readFileSync(bakPath, "utf8");
        writeFileSync(pkgPath, restored, "utf8");
        unlinkSync(bakPath);
      }
    } catch (e) {
      console.error("Failed to restore package.json from backup:", bakPath, e);
      process.exit(1);
    }
  }
}

main();
