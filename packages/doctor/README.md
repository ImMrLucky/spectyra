# @spectyra/doctor

Find where your app makes AI calls and get exact Spectyra setup instructions.

## Quick install

Install globally:

```bash
npm install -g @spectyra/doctor
```

Run from your project root:

```bash
cd /path/to/your/project
spectyra-doctor
```

Or scan a project by absolute path:

```bash
spectyra-doctor --path /absolute/path/to/your/project
```

You can also run without a global install:

```bash
npx @spectyra/doctor
npx @spectyra/doctor --path /absolute/path/to/your/project
```

The Doctor opens a browser at **http://127.0.0.1:4120** (unless you pass `--no-open` or `--no-ui`).

---

## What it does

Spectyra Doctor scans your project locally and shows:

- where AI/LLM calls happen
- which providers are used
- whether calls happen in backend, frontend, workers, or scripts
- which file should load Spectyra first
- exact copy-paste integration code
- possible optimization opportunities
- post-scan verification after integration
- possible missed AI calls (when combined with live runtime checks)

It does **not** upload your code. It does **not** read or print secret values. It is **read-only** by default (no file writes).

---

## Install the runtime SDK

After Doctor tells you where to integrate, install the runtime SDK:

```bash
npm install @spectyra/sdk
```

Add this at the top of the recommended backend entrypoint:

```ts
import '@spectyra/sdk/auto';
```

`@spectyra/sdk/auto` includes monitoring, auto instrumentation, JSONL, dev bridge support, overlay support (browser build / dev bridge on the server), confirmed-style runtime suggestions, and optimizer-related hooks.

---

## CLI reference

| Command | Description |
|--------|-------------|
| `spectyra-doctor` | Default: scan `process.cwd()`, start UI on `127.0.0.1:4120`, open browser |
| `spectyra-doctor --path /abs/project` | Scan that directory |
| `spectyra-doctor --no-open` | Do not launch a browser |
| `spectyra-doctor --no-ui` | Terminal-only (no local HTTP UI) |
| `spectyra-doctor scan` | Scan subcommand (stdout summary; use `--json` for full `DoctorScanReport`) |
| `spectyra-doctor verify` | Static verify checklist (optional live bridge: `--runtime-url http://127.0.0.1:8787`) |
| `spectyra-doctor ui` | Same as default: start UI + scan |
| `spectyra-doctor --json` | JSON output (with `scan` or terminal `--no-ui` flow) |
| `spectyra-doctor --max-file-size-mb 5` | Skip files larger than 5 MB (default: 1) |

Global binary: `spectyra-doctor` (after `npm install -g @spectyra/doctor`).

## Requirements

- Node.js 18+

## Local HTTP API (when UI is enabled)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Liveness |
| GET | `/api/scan?maxFileSizeMb=2` | Run scan (optional max file size for walkers) |
| POST | `/api/rescan` | Rescan |
| GET | `/api/result` | Last `DoctorScanResult` JSON |
| GET | `/api/verify?runtimeUrl=http://127.0.0.1:8787` | Checklist; optional `runtimeUrl` probes live dev bridge (`/__spectyra` appended if omitted) |
| POST | `/api/set-user-answer` | Body `{ "placement": "backend" \| "frontend" \| "both" \| "not_sure" }` |
| GET | `/events` | SSE progress stream |

## Safety

- Does not read `.env` file contents (paths may still be listed as scan targets where applicable).
- Redacts likely secrets in displayed snippets.
- No `pnpm` requirement; works with npm / yarn / bun for detection.

## Develop

```bash
cd packages/doctor
npm install
npm run build
node dist/cli.js --path ../../ --no-open
```

## Publish

Uses repo `tools/npm-publish-spectyra.mjs` like other `@spectyra/*` packages.
