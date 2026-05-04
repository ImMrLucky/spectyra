import { defineConfig } from "tsup";

/**
 * Bundle all `@spectyra/*` workspace packages into `dist/` so the published
 * `@spectyra/sdk` tarball has **no** runtime dependency on other `@spectyra/*`
 * npm packages (consumers only `npm install @spectyra/sdk`).
 */
const nodeBundle = defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/openai": "src/adapters/openai.ts",
    "adapters/anthropic": "src/adapters/anthropic.ts",
    "adapters/groq": "src/adapters/groq.ts",
    "auto/index": "src/auto/index.ts",
    "cli/index": "src/cli/index.ts",
    "dev/index": "src/dev/index.ts",
  },
  outDir: "dist",
  format: ["esm"],
  platform: "node",
  target: "es2022",
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  dts: true,
  noExternal: [/^@spectyra\//],
});

const browserOverlay = defineConfig({
  entry: {
    "overlay/index": "src/overlay/index.ts",
    "overlay/auto": "src/overlay/auto.ts",
  },
  outDir: "dist",
  format: ["esm"],
  platform: "browser",
  target: "es2022",
  sourcemap: true,
  clean: false,
  splitting: false,
  treeshake: true,
  dts: true,
  noExternal: ["lit", /^lit\//],
});

export default [nodeBundle, browserOverlay];
