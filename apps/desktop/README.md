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

```bash
pnpm --filter @spectyra/desktop make
```

Output: `apps/desktop/out/` (DMG, zip, Squirrel per `forge.config.cjs`).

Upload those artifacts to **your** download location (website, S3, license portal). Optional CI template: [`.github/workflows/release-desktop.yml`](../../.github/workflows/release-desktop.yml) — can run in **private** infrastructure; outputs are still uploaded to **your** hosting, not GitHub Releases.
