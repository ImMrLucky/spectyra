# @spectyra/auto

One-line **metadata-only** AI cost monitoring for **Node.js** backends. Patches `globalThis.fetch` and `http` / `https` outbound requests to known LLM API hosts, records token usage and estimated USD into the same monitor buffer + JSONL as `@spectyra/sdk` — **no prompts, responses, or API keys** are persisted.

Local monitoring works **without** a Spectyra account. Optional `SPECTYRA_API_KEY` is only for future cloud sync (not wired in this version).

**Honest scope:** this package only sees traffic from **this process** that goes through patched `globalThis.fetch`, **axios** (if installed), and `http` / `https` **via the CommonJS export object** (`require('node:http')`, or `import http from 'node:http'`). Code that uses `import * as http from 'node:http'` gets a frozen namespace in modern Node; those calls are **not** patched. For optimization and full attribution, use `@spectyra/sdk` `complete()`.

## Install

```bash
npm install @spectyra/auto
```

## One-line (env-gated)

Set `SPECTYRA_AUTO=true`, then:

```ts
import "@spectyra/auto";
```

Patches install when the module loads (only if `SPECTYRA_AUTO=true`).

## Explicit start (recommended)

```ts
import { startSpectyraAuto, stopSpectyraAuto } from "@spectyra/auto";

const engine = startSpectyraAuto({
  project: "support-api",
  environment: process.env.NODE_ENV ?? "development",
  service: "api",
  jsonlPath: "./logs/spectyra-usage.jsonl",
});

// … later
stopSpectyraAuto();
```

## Dev bridge (browser + `@spectyra/devtools`)

Expose the in-process buffer to the browser during local development:

```ts
import express from "express";
import { startSpectyraAuto, getAutoMonitorEngine, stopSpectyraAuto } from "@spectyra/auto";
import { createSpectyraDevBridgeConnectMiddleware } from "@spectyra/sdk";

startSpectyraAuto({ jsonlEnabled: true, jsonlPath: "./logs/spectyra-usage.jsonl" });

const app = express();
app.use(createSpectyraDevBridgeConnectMiddleware(() => getAutoMonitorEngine()));
// … your routes
```

Set `SPECTYRA_DEV_BRIDGE=true` in production if you intentionally need this (default is off when `NODE_ENV=production`). See `@spectyra/devtools` for the Lit `<spectyra-monitor-strip>` widget.

## Environment variables

| Variable | Meaning |
|----------|---------|
| `SPECTYRA_AUTO` | `true` → side-effect import starts auto |
| `SPECTYRA_PROJECT` | Default project label on events |
| `SPECTYRA_ENV` | Environment label |
| `SPECTYRA_SERVICE` | Service label |
| `SPECTYRA_JSONL` | `false` disables JSONL (buffer + console only) |
| `SPECTYRA_JSONL_PATH` | JSONL file path |
| `SPECTYRA_CONSOLE` | `true` enables monitor console lines |
| `SPECTYRA_API_KEY` | Reserved for cloud sync (optional) |

## API

- **`startSpectyraAuto(opts?)`** — installs patches, returns `MonitorEngine` from `@spectyra/sdk`.
- **`stopSpectyraAuto()`** — removes patches and clears the singleton.
- **`getAutoMonitorEngine()`** — current engine or `null`.

## Safety

- Fail-open: patch errors never throw into your app.
- Unknown hosts are ignored.
- Response bodies are read only from **`Response.clone()`** (fetch) or a **size-capped** buffer (HTTP); originals are returned unchanged to callers.

See `docs/SPECTYRA_AI_MONITOR_SPEC.md` for the full product spec.
