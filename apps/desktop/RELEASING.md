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
- The desktop build sets **`electronLanguages`** (English-only) to drop most Chromium locale packs, and excludes **`*.map`** from the bundled companion — meaningful savings without changing runtime behavior for English users.
- Optional: pass **`-c.compression=maximum`** to electron-builder for a bit smaller archives (much slower builds; often only a few percent vs locale trimming).
- The **NSIS `.exe`** is often **smaller than the `.zip`** of the same app (compressed installer vs archiving the folder). If a **`.zip` is still over ~100 MB** (e.g. strict git limits), ship the **installer** via **GitHub Releases** instead of committing binaries to the repo.
- Optional: add a **`7z`** target in `electron-builder.yml` if you want a smaller archive than zip for manual distribution (users need 7-Zip or `tar`/`bsdtar` to extract).

## When to rebuild

- Changes under `apps/desktop/electron/**`, `apps/desktop/package.json`, `electron-builder.yml`
- Changes to `apps/web` that affect the **desktop** Angular bundle
- Changes to `tools/local-companion` or packages it depends on
