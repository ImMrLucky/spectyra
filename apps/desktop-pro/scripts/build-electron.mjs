import { build } from "esbuild";

const shared = {
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  outdir: "dist-electron",
  sourcemap: true,
  external: ["electron"],
  define: {
    "process.env.SPECTYRA_EDITION": '"pro"',
  },
};

await Promise.all([
  build({ ...shared, entryPoints: ["../desktop/electron/main.ts"] }),
  build({ ...shared, entryPoints: ["../desktop/electron/preload.ts"] }),
]);
