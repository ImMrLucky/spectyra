import { defineConfig } from "tsup";

/**
 * Bundle all `@spectyra/*` workspace packages into `dist/` so the published
 * `@spectyra/sdk` tarball has **no** runtime dependency on other `@spectyra/*`
 * npm packages (consumers only `npm install @spectyra/sdk`).
 */
export default defineConfig({
  entry: {
    index: "src/index.ts",
    "adapters/openai": "src/adapters/openai.ts",
    "adapters/anthropic": "src/adapters/anthropic.ts",
    "adapters/groq": "src/adapters/groq.ts",
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
