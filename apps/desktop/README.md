# Spectyra Desktop

Electron app with **provider key management**, **license activation**, and an **embedded Local Companion** (OpenAI-compatible server) — no separate Node process required.

## Quick links

- **Install without building:** [docs/INSTALL_AND_SETUP.md](../../docs/INSTALL_AND_SETUP.md)
- **Prebuilt downloads:** [GitHub Releases](https://github.com/spectyra/spectyra/releases) (when CI publishes artifacts)

## Development

```bash
# From repository root
pnpm install
pnpm --filter @spectyra/desktop dev
```

## Build installers locally

```bash
pnpm --filter @spectyra/desktop make
```

Output: `apps/desktop/out/` (DMG, zip, Squirrel per `forge.config.cjs`).

## CI builds

Tag push triggers [`.github/workflows/release-desktop.yml`](../../.github/workflows/release-desktop.yml) — download **Artifacts** from the workflow run, or attach them to a GitHub Release for end users.
