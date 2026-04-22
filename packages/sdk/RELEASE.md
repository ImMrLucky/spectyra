# @spectyra/sdk release checklist

Use this before every npm publish so the tarball matches source and docs stay honest.

1. **Install & build** — From repo root: `pnpm --filter @spectyra/sdk run build` (runs `tsc` into `dist/`).
2. **Pack** — `cd packages/sdk && npm pack` and note the generated `.tgz` path.
3. **Inspect the tarball** — `tar -tzf spectyra-sdk-*.tgz | head -80` and confirm `package/dist/index.js`, adapter files under `package/dist/adapters/`, and `package.json` `exports` align with public imports.
4. **Smoke-import** — In a temp directory: `npm install <path-to-tgz>`, then `node -e "import('@spectyra/sdk').then(m => console.log(!!m.createSpectyra))"` and optionally the same for `@spectyra/sdk/adapters/openai`.
5. **Docs parity** — README quick start and web **In-app SDK** snippets should use the same imports as the built package (`@spectyra/sdk` and `@spectyra/sdk/adapters/*`).
6. **Telemetry** — Confirm `telemetry: { mode: "cloud_redacted" }` is documented wherever cloud POSTs are described; cloud sync does not run in default `local` mode.
7. **Publish** — Only after steps 1–6 pass: `npm publish` (from `packages/sdk` with correct npm auth).

Do not commit generated `.tgz` files to the main SDK folder; they confuse release verification.
