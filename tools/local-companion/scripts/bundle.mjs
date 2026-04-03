/**
 * Bundle the Local Companion into a single CJS file using esbuild.
 *
 * All @spectyra/* workspace packages (which ship as raw .ts source) are inlined.
 * Third-party npm packages (express, cors, etc.) are kept external — they have
 * compiled JS and are shipped in node_modules by pnpm deploy.
 */
import { build } from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

await build({
  entryPoints: [path.join(root, "src", "companion.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outfile: path.join(root, "dist", "companion.cjs"),
  sourcemap: false,
  external: [
    "express",
    "cors",
  ],
  tsconfig: path.join(root, "tsconfig.json"),
});

console.log("Companion bundled → dist/companion.cjs");
