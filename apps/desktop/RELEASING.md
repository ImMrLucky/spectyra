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

## When to rebuild

- Changes under `apps/desktop/electron/**`, `apps/desktop/package.json`, `electron-builder.yml`
- Changes to `apps/web` that affect the **desktop** Angular bundle
- Changes to `tools/local-companion` or packages it depends on
