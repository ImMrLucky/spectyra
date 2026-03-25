# Spectyra Desktop

Electron app with **provider key management**, **license activation**, and an **embedded Local Companion** (OpenAI-compatible server) — no separate Node process required.

## Who this is for

Users who want Spectyra **without** adding the npm SDK to a codebase: run a **normal desktop app**, paste keys, configure mode, and use the built-in companion.

## End users (download + run)

1. Download the **installer** from your product **Download** page — e.g. **[spectyra.netlify.app](https://spectyra.netlify.app/)** (or your customer portal / email link).
2. Install **Spectyra** like any other app (DMG on macOS, installer on Windows).
3. Open the app and follow the on-screen setup for provider keys and license.

**You do not need GitHub or a source checkout** to use the desktop app. Distribution is **signed binaries** hosted on **your** website or CDN, not necessarily a public code host.

More context: [docs/INSTALL_AND_SETUP.md](../../docs/INSTALL_AND_SETUP.md)

## Developers (build from source)

```bash
# From repository root
pnpm install
pnpm --filter @spectyra/desktop dev
```

## Build installers (for release engineering)

Electron Forge + this pnpm monorepo needs an **isolated deploy** so dependencies resolve correctly. From the **repository root**:

```bash
pnpm desktop:make
```

This runs `pnpm deploy` into `apps/desktop/deploy-out/` (gitignored), then `electron-forge make` there. Artifacts: `apps/desktop/deploy-out/out/make/` (e.g. `Spectyra.dmg`, zip).

**Windows portable from macOS:** `pnpm desktop:make:win32` → copy the zip to `apps/web/src/assets/downloads/Spectyra-windows.zip`.

**When to rebuild installers:** [RELEASING.md](./RELEASING.md).

To ship with the Netlify Angular UI, copy artifacts into `apps/web/src/assets/downloads/` (see `desktopDownloadsSameOrigin` in the web `environment`), then deploy the web app.

CI: [`.github/workflows/release-desktop.yml`](../../.github/workflows/release-desktop.yml) (macOS + Windows).
