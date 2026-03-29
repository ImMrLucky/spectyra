import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outdir: "dist-electron",
  sourcemap: true,
  external: ["electron"],
};

await Promise.all([
  build({ ...shared, entryPoints: ["electron/main.ts"] }),
  build({ ...shared, entryPoints: ["electron/preload.ts"] }),
]);
