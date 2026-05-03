# @spectyra/doctor

**Spectyra Integration Doctor** — scan a project locally for AI/LLM usage, Spectyra packages, and suggested setup. **Read-only**: no code writes in v1, no uploads, no reading `.env` file contents (only variable names in source).

## Usage

```bash
# Default: UI on http://127.0.0.1:4120 + scan + open browser
npx @spectyra/doctor

# Scan a specific project
npx @spectyra/doctor --path /absolute/path/to/app

# No browser
npx @spectyra/doctor --no-open

# Terminal-only scan (no local server)
npx @spectyra/doctor --no-ui

# Subcommands
npx @spectyra/doctor scan
npx @spectyra/doctor verify

# JSON
npx @spectyra/doctor scan --json
```

Global binary (after install): `spectyra-doctor`.

## Requirements

- Node 18+

## What it does

- Walks source files (`*.ts`, `*.tsx`, `*.js`, `*.jsx`, `*.mjs`, `*.cjs`, `*.py`) skipping `node_modules`, build outputs, `.git`, etc.
- Skips files larger than 1 MB.
- Detects providers (URLs, env var **names**), AI-ish call sites, frameworks from `package.json`, likely entrypoints, and Spectyra-related imports.
- Serves a small local UI with SSE (`GET /events`) for live progress and copy-paste recommendations.

## API (local server)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/scan` | Run scan, store result |
| POST | `/api/rescan` | Rescan |
| GET | `/api/result` | Last `DoctorScanResult` JSON |
| GET | `/api/verify` | Checklist (runs scan if none yet) |
| POST | `/api/set-user-answer` | Body `{ "placement": "backend" \| "frontend" \| "both" \| "not_sure" }` |
| GET | `/events` | SSE progress stream |

## Safety

- Does not read `.env` (paths ignored by scanner).
- Redacts likely secrets in snippets (`sk-…`, `Bearer …`, etc.).
- No `pnpm` requirement; works with npm/yarn/bun lockfiles for **detection** only.

## Develop

```bash
cd packages/doctor
npm install
npm run build
node dist/cli.js --path ../../ --no-open
```

## Publish

Uses repo `tools/npm-publish-spectyra.mjs` like other `@spectyra/*` packages.
