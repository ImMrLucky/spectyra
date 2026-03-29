# Spectyra Desktop (Electron)

Local-first desktop app: **Electron** shell + **Local Companion** child process (OpenAI-compatible `http://127.0.0.1:4111/v1`) + **Angular** UI (desktop build).

## Layout

| Path | Role |
|------|------|
| `electron/main.ts` | Main process: window, IPC, spawn companion, config under `~/.spectyra/desktop/` |
| `electron/preload.ts` | Exposes `window.spectyra` to the renderer |
| `dist-electron/*.js` | Compiled main/preload (CommonJS) |
| `../web` (desktop build) | Angular output → `dist/renderer/` (includes **Live savings**: SSE + detailed local metrics; optional redacted cloud sync when signed in) |
| `resources/companion/` | Produced by `scripts/prepare-companion.cjs` (`pnpm deploy` of `@spectyra/local-companion`) |
| `electron-builder.yml` | Packaging: macOS DMG+zip, Windows NSIS+zip |

## Dev (two terminals)

1. **Angular** (desktop configuration, hash routing, `http://127.0.0.1:4200`):

   ```bash
   cd apps/web && pnpm exec ng serve --configuration desktop --port 4200
   ```

2. **Electron** (loads dev URL, starts companion subprocess):

   ```bash
   # repo root
   pnpm desktop:dev
   ```

Ensure `tools/local-companion` is built (`pnpm --filter @spectyra/local-companion build`) before first run.

## Package installers

From **repository root**:

```bash
pnpm desktop:dist
```

Artifacts: `apps/desktop/release/` (`.dmg`, `.zip`, NSIS `.exe`, etc., per platform).

**Windows zip:** To force a fresh `*-win-x64.zip` (electron-builder can skip re-zipping if an old zip looks “up to date”), use **`pnpm desktop:dist:win`** from the repo root instead of `pnpm desktop:dist` when cross-building Windows.

Prerequisites: `pnpm install`, local-companion built, Angular desktop build, and `resources/companion` (the `dist` script runs `build` which includes `prepare:companion`).

## Runtime behavior (main process)

- **Single instance:** A second launch focuses the existing window instead of starting another copy (avoids two Local Companions fighting for the same port).
- **macOS:** Closing the last window does **not** quit the app (standard dock behavior); the Local Companion keeps running for `localhost` tools. Use **Quit** from the menu or **Cmd+Q** to exit fully.

## Security notes

- Provider API keys are stored in `~/.spectyra/desktop/config.json` (local disk only).
- Companion runs with `ELECTRON_RUN_AS_NODE=1` and your keys in `SPECTYRA_PROVIDER_KEYS_JSON` — no separate Node install.
- License validation may call the Spectyra API; inference does not go through Spectyra cloud.

See also: [RELEASING.md](./RELEASING.md), [tools/local-companion/README.md](../../tools/local-companion/README.md).

## Troubleshooting (signed-in cloud features)

If the **Mac or Windows** app errors when talking to your API (e.g. org load / billing / session) and your server logs mention **`platform_exempt`** or **`platform_roles`**, the **Postgres** behind the API is missing migration **`apps/api/src/services/storage/migrations/010_platform_roles.sql`**. Open **Supabase → SQL** (or `psql` with `DATABASE_URL`), run that whole file once, then redeploy or restart the API if needed. This is a **database** change, not something you install on the Mac itself.

### macOS: double-click does nothing / no window

That is usually **not** the SQL migration (that affects the **API**, not local Electron startup). Try:

1. **Right‑click the app → Open** once if Gatekeeper still blocks unsigned builds (see [docs/INSTALL_AND_SETUP.md](../../docs/INSTALL_AND_SETUP.md)).
2. **Rebuild and reinstall** a fresh `.dmg` from `pnpm desktop:dist` — recent builds show a **dialog** if the UI bundle is missing or `loadFile` fails, instead of quitting silently.
3. Open **Console.app** and filter for **Spectyra** to see crash logs if the process exits immediately.
