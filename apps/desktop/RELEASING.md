# Desktop releases (electron-builder)

Ship new **macOS** / **Windows** binaries when the packaged app changes.

## Build

From the **repository root**:

```bash
pnpm install
pnpm desktop:dist
```

Outputs: **`apps/desktop/release/`** (contents depend on host OS: on macOS you get `.dmg` and `.zip`; on Windows, NSIS `.exe` and `.zip`). Filenames include version and arch (e.g. `Spectyra-1.0.0-mac-x64.dmg`) per `artifactName` in `electron-builder.yml`.

To produce **both** platforms without local machines, use GitHub Actions (`.github/workflows/release-desktop.yml`) on `windows-latest` and `macos-latest`.

### Same-origin download page (Netlify)

The web app’s `desktopDownloadsSameOrigin` paths expect **stable** names: **`Spectyra-mac.dmg`**, **`Spectyra-windows.exe`**, optional **`Spectyra-windows.zip`**. After building, copy or rename the release artifacts into **`apps/web/src/assets/downloads/`** under those names before deploy (do not commit large binaries unless your team chooses to).

## What gets bundled

- `dist-electron/` — Electron main + preload
- `dist/renderer/` — Angular **desktop** build (`ng build --configuration desktop`)
- `resources/companion/` — deployed `@spectyra/local-companion` (from `scripts/prepare-companion.cjs`)

## Hosting binaries

Do not commit large installers to git. Prefer CDN / object storage / GitHub Release assets and (if used) API env vars such as `DESKTOP_DOWNLOAD_*` documented elsewhere.

### Size (GitHub & uploads)

- **Electron + Chromium dominate** the Windows/macOS packages; the Angular UI and companion add relatively little.
- The desktop build sets **`electronLanguages`** (English-only) to drop most Chromium locale packs.
- **Windows** uses **`win.compression: maximum`** so the **`.zip`** (and NSIS intermediates) compress harder; macOS dmg/zip stay on default compression so local/CI mac builds stay faster.
- **Angular desktop** uses **`sourceMap: false`** (no `.map` in `dist/renderer`), **`files` excludes `*.map`**, and the companion script strips **`*.map`** plus **test/docs markdown** under `node_modules` after `pnpm deploy`.
- The **NSIS `.exe`** is often **smaller than the `.zip`** of the same app. If the zip is still tight on a **~100 MB** limit, prefer shipping the **installer** via **GitHub Releases** (or another CDN) instead of the portable zip.
- **Stale zip:** electron-builder may skip re-zipping when an existing `*-win-x64.zip` looks newer than `win-unpacked`. From `apps/desktop`, run **`pnpm run dist:win`** (or delete that zip, then run `electron-builder --win`) so the zip always matches the latest build.

## macOS code signing & notarization (no Gatekeeper warning)

Unsigned `.dmg` / `.app` builds trigger **“Apple could not verify…”** on end-user Macs. To ship a build that opens without right‑click → Open, you need:

1. **Apple Developer Program** membership (paid).
2. A **Developer ID Application** certificate installed in your Mac keychain (Xcode → Settings → Accounts → Manage Certificates, or create via Apple Developer portal).
3. **Notarization** so Gatekeeper accepts the app on first launch.

**electron-builder** will sign and submit for notarization when you build **on macOS** with the usual environment variables set (see [electron-builder code signing](https://www.electron.build/code-signing)):

| Variable | Purpose |
|----------|---------|
| `CSC_LINK` | Path to a `.p12` export of your **Developer ID Application** cert, **or** `keychain:` / path to identity |
| `CSC_KEY_PASSWORD` | Password for the `.p12` file (if used) |
| `APPLE_ID` | Apple ID used for notarization |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password (Apple ID → Security) |
| `APPLE_TEAM_ID` | 10-character Team ID |

If these are **not** set, `pnpm desktop:dist` still produces a working `.dmg`, but users must bypass Gatekeeper once (documented in **[docs/INSTALL_AND_SETUP.md](../../docs/INSTALL_AND_SETUP.md)**).

`electron-builder.yml` sets `mac.gatekeeperAssess: false` so the **build machine** does not fail the pre-staple assessment; end-user Gatekeeper is satisfied by **signing + notarization**, not by this flag alone.

## When to rebuild

- Changes under `apps/desktop/electron/**`, `apps/desktop/package.json`, `electron-builder.yml`
- Changes to `apps/web` that affect the **desktop** Angular bundle
- Changes to `tools/local-companion` or packages it depends on
