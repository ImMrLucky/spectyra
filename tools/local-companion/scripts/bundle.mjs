/**
 * Bundle the Local Companion into a single CJS file using esbuild.
 *
 * All @spectyra/* workspace packages (which ship as raw .ts source) are inlined.
 * Third-party npm packages (express, cors, etc.) are kept external — they have
 * compiled JS and are shipped in node_modules by pnpm deploy.
 */
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf-8"));
const versionLiteral =
  typeof pkg.version === "string" ? pkg.version : "0.0.0";

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  sourcemap: false,
  external: ["express", "cors"],
  tsconfig: path.join(root, "tsconfig.json"),
  define: {
    __SPECTYRA_COMPANION_VERSION__: JSON.stringify(versionLiteral),
  },
};

await build({
  ...shared,
  entryPoints: [path.join(root, "src", "companion.ts")],
  outfile: path.join(root, "dist", "companion.cjs"),
});

await build({
  ...shared,
  entryPoints: [path.join(root, "src", "cli.ts")],
  outfile: path.join(root, "dist", "cli.cjs"),
  banner: { js: "#!/usr/bin/env node" },
});

console.log("Companion bundled → dist/companion.cjs + dist/cli.cjs");
