# Desktop app — when to rebuild installers

Ship new **macOS** / **Windows** binaries whenever the packaged app changes. The web `/download` page expects these **same-origin** filenames under `apps/web/src/assets/downloads/` (unless you override via API env vars):

| File | What it is |
|------|------------|
| `Spectyra-mac.dmg` | macOS disk image (run the app from Applications). |
| `Spectyra-windows.exe` | Windows **installer** (Squirrel — built on Windows or CI). |
| `Spectyra-windows.zip` | Windows **portable** (extract anywhere, run `spectyra.exe`). Optional but recommended for users who can’t run installers. |

Users get **macOS: .dmg** and **Windows: installer .exe** as the main options; **.zip** is an extra choice on the same page.

## When you **must** rebuild and re-upload

Do a new desktop build + copy into `apps/web/src/assets/downloads/` (then redeploy Netlify) if **any** of these change:

| Area | Examples |
|------|----------|
| **Desktop code** | `apps/desktop/src/**`, preload, embedded UI |
| **Desktop metadata** | `version` in `apps/desktop/package.json`, Electron version, `forge.config.cjs`, icons |
| **Packages the desktop bundles** | `@spectyra/core-types`, `canonical-model`, `feature-detection`, `optimization-engine` (anything `apps/desktop` imports from the monorepo) |
| **Desktop dependencies** | `express`, `cors`, etc. in `apps/desktop/package.json` |

## When you **do not** need a new installer

- API-only, database, or `apps/web` changes that the desktop app does not embed
- `packages/sdk` or other packages **not** imported by the desktop app
- Docs-only changes

If unsure, search the desktop app for imports: `apps/desktop/src/**/*.ts`.

## Build commands (from repository root)

```bash
pnpm install
```

**macOS (.dmg)** — on a Mac:

```bash
pnpm desktop:make
```

Copy `apps/desktop/deploy-out/out/make/Spectyra.dmg` → `apps/web/src/assets/downloads/Spectyra-mac.dmg`.

**Windows portable (.zip)** — works on macOS or Windows (no Squirrel on macOS):

```bash
pnpm desktop:make:win32
```

Copy `apps/desktop/deploy-out/out/make/zip/win32/x64/Spectyra-win32-x64-*.zip` → `apps/web/src/assets/downloads/Spectyra-windows.zip`.

**Windows installer (`Spectyra-windows.exe`)** — must run **on Windows** (or GitHub Actions `windows-latest`). From repo root:

```bash
pnpm --filter @spectyra/desktop deploy apps/desktop/deploy-out
pnpm --dir apps/desktop/deploy-out run make
```

In `out/make/`, find the Squirrel **Setup** `.exe` (name varies by version). **Rename** it to `Spectyra-windows.exe` and copy into `apps/web/src/assets/downloads/` for Netlify, or host it elsewhere and set `DESKTOP_DOWNLOAD_WINDOWS_URL` on the API.

### Why isn’t the app a single `.exe`?

The **installer** `.exe` (Squirrel) is one download that installs the full app. The raw app is still many files on disk after install. The **portable zip** avoids an installer: extract and run `spectyra.exe`.

## CI

See `.github/workflows/release-desktop.yml` — macOS and Windows jobs build artifacts you can download and copy into `assets/downloads/` or your CDN.
