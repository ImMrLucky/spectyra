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

## When to rebuild

- Changes under `apps/desktop/electron/**`, `apps/desktop/package.json`, `electron-builder.yml`
- Changes to `apps/web` that affect the **desktop** Angular bundle
- Changes to `tools/local-companion` or packages it depends on
