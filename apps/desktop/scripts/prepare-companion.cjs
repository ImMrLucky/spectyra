/**
 * Build and deploy @spectyra/local-companion into apps/desktop/resources/companion
 * for electron-builder extraResources. Run from repo root via pnpm.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const repoRoot = path.join(__dirname, "..", "..", "..");
const target = path.join(repoRoot, "apps", "desktop", "resources", "companion");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: repoRoot, stdio: "inherit", shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

fs.rmSync(target, { recursive: true, force: true });
run("pnpm", ["--filter", "@spectyra/local-companion", "build"]);
run("pnpm", ["--filter", "@spectyra/local-companion", "deploy", "apps/desktop/resources/companion"]);

/** Drop source maps from the deployed tree (not needed at runtime; smaller desktop bundle). */
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

/**
 * Remove dev-only cruft from deployed node_modules (docs, tests, licenses as files).
 * Safe for runtime: we only run compiled JS from dist/ + package deps.
 */
const JUNK_DIR = new Set([
  "test",
  "tests",
  "__tests__",
  "docs",
  "doc",
  "examples",
  "example",
  "coverage",
  "benchmark",
  "benchmarks",
  "html",
  "man",
  ".github",
  "ci",
]);

function pruneNodeModulesJunk(roots) {
  const nm = path.join(roots, "node_modules");
  if (!fs.existsSync(nm)) return;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      const n = e.name.toLowerCase();
      if (e.isDirectory()) {
        if (JUNK_DIR.has(n)) {
          fs.rmSync(p, { recursive: true, force: true });
        } else {
          walk(p);
        }
      } else if (e.isFile()) {
        if (/\.md$/i.test(e.name) || /^license/i.test(e.name) || /^changelog/i.test(e.name) || /^authors$/i.test(e.name)) {
          try {
            fs.unlinkSync(p);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }
  walk(nm);
}

pruneNodeModulesJunk(target);

console.log("Companion bundle ready at apps/desktop/resources/companion");
