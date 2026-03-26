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
console.log("Companion bundle ready at apps/desktop/resources/companion");
