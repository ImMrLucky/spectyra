/**
 * Build and deploy @spectyra/local-companion into apps/desktop-pro/resources/companion.
 * Mirrors apps/desktop/scripts/prepare-companion.cjs but targets this edition.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const repoRoot = path.join(__dirname, "..", "..", "..");
const target = path.join(repoRoot, "apps", "desktop-pro", "resources", "companion");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

fs.rmSync(target, { recursive: true, force: true });

run("pnpm", ["--filter", "@spectyra/local-companion", "build"]);
run("pnpm", ["--filter", "@spectyra/local-companion", "deploy", "apps/desktop-pro/resources/companion"]);

const nm = path.join(target, "node_modules", "@spectyra");
if (fs.existsSync(nm)) {
  fs.rmSync(nm, { recursive: true, force: true });
}

function removeFilesRecursive(dir, predicate) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) removeFilesRecursive(p, predicate);
    else if (predicate(p)) fs.unlinkSync(p);
  }
}
removeFilesRecursive(target, (p) => p.endsWith(".map"));

const JUNK_DIR = new Set([
  "test", "tests", "__tests__", "docs", "doc", "examples", "example",
  "coverage", "benchmark", "benchmarks", "html", "man", ".github", "ci",
]);

function pruneNodeModulesJunk(roots) {
  const nmDir = path.join(roots, "node_modules");
  if (!fs.existsSync(nmDir)) return;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (JUNK_DIR.has(e.name.toLowerCase())) fs.rmSync(p, { recursive: true, force: true });
        else walk(p);
      } else if (e.isFile()) {
        if (/\.md$/i.test(e.name) || /^license/i.test(e.name) || /^changelog/i.test(e.name) || /^authors$/i.test(e.name)) {
          try { fs.unlinkSync(p); } catch {}
        }
      }
    }
  }
  walk(nmDir);
}
pruneNodeModulesJunk(target);

console.log("Companion bundle ready at apps/desktop-pro/resources/companion");
