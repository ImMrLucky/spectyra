# @spectyra/auto

One-line **metadata-only** AI cost monitoring for **Node.js** backends. Patches `globalThis.fetch` and `http` / `https` outbound requests to known LLM API hosts, records token usage and estimated USD into the same monitor buffer + JSONL as `@spectyra/sdk` — **no prompts, responses, or API keys** are persisted.

Local monitoring works **without** a Spectyra account. Optional **Spectyra Cloud** upload uses a **dashboard** API key (`SPECTYRA_CLOUD_API_KEY` / `SPECTYRA_API_KEY`) plus `SPECTYRA_CLOUD_SYNC=true` or `startSpectyraAuto({ cloudSync: true })`.

**Honest scope:** this package only sees traffic from **this process** that goes through patched `globalThis.fetch`, **axios** (if installed), and `http` / `https` **via the CommonJS export object** (`require('node:http')`, or `import http from 'node:http'`). Code that uses `import * as http from 'node:http'` gets a frozen namespace in modern Node; those calls are **not** patched. For optimization and full attribution, use `@spectyra/sdk` `complete()`.

## For app developers (copy this)

### Install

```bash
npm install @spectyra/auto
```

Optional browser overlay:

```bash
npm install @spectyra/devtools
```

### 1) API server — put this in your main server file (Express example)

Use the **same file** where you create `express()` and `app.listen` (or wherever you attach global middleware **before** your routes).

```ts
import express from "express";
import { startSpectyraAuto, useSpectyraAutoDevBridge } from "@spectyra/auto";

const app = express();

// A) Monitoring (always, in prod): records LLM traffic metadata in-process + optional JSONL
startSpectyraAuto({
  project: "my-app",
  environment: process.env.NODE_ENV ?? "production",
  service: "api",
  jsonlEnabled: process.env.NODE_ENV !== "production",
  cloudSync: true, // or set env SPECTYRA_CLOUD_SYNC=true — see “Spectyra Cloud” below
});

// B) Browser overlay (optional): OFF in production unless you opt in — see “Overlay” below
if (process.env.SPECTYRA_OVERLAY_DEV === "true") {
  useSpectyraAutoDevBridge(app, {
    enabled: true,
    token: process.env.SPECTYRA_OVERLAY_TOKEN,
    allowedHosts: [new URL(process.env.PUBLIC_API_URL ?? "http://localhost:3000").hostname],
  });
}

// … then your routes:
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(3000);
```

**Order:** `startSpectyraAuto` first, then `useSpectyraAutoDevBridge` (if used), then routes.

### 2) Spectyra Cloud (spectyra.ai dashboards)

Set a **Spectyra dashboard / machine API key** (not an OpenAI key):

```bash
export SPECTYRA_CLOUD_API_KEY="…"   # or SPECTYRA_API_KEY
export SPECTYRA_CLOUD_SYNC="true"
```

Or pass `cloudSync: true` from code **and** set the key in env (recommended for production secrets).

Optional: `SPECTYRA_API_BASE_URL` if you use a non-default Spectyra API host.

### 3) Browser overlay (developers only by default)

- **Do not** import `@spectyra/devtools/auto` in your production frontend bundle for all users.
- **Do** import it in **local dev**, or behind an **internal** route, or when the dev bridge is enabled on the API **and** you personally enable the client.

**Split UI + API (e.g. Netlify + Railway) — one script, no Netlify `API_URL` required**

After `useSpectyraAutoDevBridge` is mounted, your API serves `GET /__spectyra/overlay-bootstrap.js` (CORS-enabled). In your frontend **`index.html`**, **before** your app bundle:

```html
<script src="https://YOUR_API_ORIGIN/__spectyra/overlay-bootstrap.js"></script>
```

That sets `window.__SPECTYRA_OVERLAY_BASE_URL__` from the request (or from `publicOrigin` in bridge options if your proxy strips `Host` / `X-Forwarded-*`).

Then load the overlay (e.g. in `main.ts`):

```ts
import "@spectyra/devtools/auto";
```

**Manual globals** (same as before, if you prefer not to use the bootstrap script):

```ts
window.__SPECTYRA_OVERLAY_BASE_URL__ = "https://api.example.com"; // if UI ≠ API origin
window.__SPECTYRA_OVERLAY_BRIDGE_TOKEN__ = "…"; // same secret as bridge `token` when used
window.__SPECTYRA_OVERLAY_FORCE__ = true; // show on non-localhost
import "@spectyra/devtools/auto";
```

Or `<html data-spectyra-overlay="force">` instead of `__SPECTYRA_OVERLAY_FORCE__`.

---

## Install

```bash
npm install @spectyra/auto
```

## One-line (env-gated)

Set `SPECTYRA_AUTO=true`, then:

```ts
import "@spectyra/auto";
```

Patches install when the module loads **only** if `SPECTYRA_AUTO` is `true` or `1`.  
If you use **`startSpectyraAuto({...})`** with options, you do **not** need `SPECTYRA_AUTO` (implicit auto-start stays off by default).

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

## Dev bridge + browser overlay (simplest path)

**1. API (Node)** — after `startSpectyraAuto`:

```ts
import express from "express";
import { startSpectyraAuto, useSpectyraAutoDevBridge } from "@spectyra/auto";

startSpectyraAuto({ jsonlEnabled: true, jsonlPath: "./logs/spectyra-usage.jsonl" });

const app = express();
useSpectyraAutoDevBridge(app, {
  enabled: true, // required when NODE_ENV=production; omit in dev
  token: process.env.SPECTYRA_OVERLAY_TOKEN, // recommended in prod
  allowedHosts: ["api.example.com"],
});
```

**2. Browser** — install `@spectyra/devtools`, then one import:

```ts
import "@spectyra/devtools/auto";
```

- **Same origin** as the API: nothing else required on localhost / `*.local`.
- **Different API host:** set before the import: `window.__SPECTYRA_OVERLAY_BASE_URL__ = "https://api.example.com";`
- **Production hostname:** `window.__SPECTYRA_OVERLAY_FORCE__ = true` **or** `<html data-spectyra-overlay="force">`.
- **Bridge `token`:** `window.__SPECTYRA_OVERLAY_BRIDGE_TOKEN__ = "<same secret>"`.

See `@spectyra/devtools` for `<spectyra-monitor-strip>` and manual `<spectyra-overlay>` usage.

Use `SPECTYRA_DEV_BRIDGE=true` instead of `enabled: true` if you prefer env-only control.

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
| `SPECTYRA_CLOUD_SYNC` | `true` + dashboard key → POST monitor batches to Spectyra Cloud |
| `SPECTYRA_CLOUD_API_KEY` | Spectyra dashboard / machine key (`X-SPECTYRA-API-KEY`) |
| `SPECTYRA_API_KEY` | Alternate env name for the same dashboard key |
| `SPECTYRA_API_BASE_URL` | Optional Spectyra API root including `/v1` |
| `SPECTYRA_OVERLAY_DEV` | When `true` on the server, mount the dev bridge for the overlay (see “For app developers”) |
| `SPECTYRA_OVERLAY_TOKEN` | Shared secret for overlay ↔ bridge when `token` is set on `useSpectyraAutoDevBridge` |

## API

- **`startSpectyraAuto(opts?)`** — installs patches, returns `MonitorEngine` from `@spectyra/sdk`.
- **`stopSpectyraAuto()`** — removes patches and clears the singleton.
- **`getAutoMonitorEngine()`** — current engine or `null`.
- **`useSpectyraAutoDevBridge(app, options?)`** — `app.use` the Spectyra dev bridge for `@spectyra/devtools` / `<spectyra-overlay>`.

## Safety

- Fail-open: patch errors never throw into your app.
- Unknown hosts are ignored.
- Response bodies are read only from **`Response.clone()`** (fetch) or a **size-capped** buffer (HTTP); originals are returned unchanged to callers.

See `docs/SPECTYRA_AI_MONITOR_SPEC.md` for the full product spec.
