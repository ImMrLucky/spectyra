# Spectyra OpenClaw Optimizer Plugin

Native Spectyra savings and prompt-security visibility inside OpenClaw.

## ⚡ Quick Start

1. **Install the OpenClaw plugin:**

```bash
openclaw plugins install @spectyra/openclaw-plugin
```

2. **Start Spectyra:**

```bash
npx @spectyra/local-companion start --open
```

3. **Open OpenClaw** and run any prompt.

You should see Spectyra savings directly inside OpenClaw once the local companion is connected.

**Seamless savings:** the companion exposes read-only `GET /openclaw/v1/latest` (plus `recent`, `flows/latest`, `status`) on `127.0.0.1:4111`. The plugin polls `latest` every few seconds and shows the most recent run **without** wiring trace IDs or flow metadata yourself. If inline attachment is not available, the Spectyra side/status panel still shows **Latest OpenClaw savings** from the same endpoint.

---

## What you will see

- Savings badges under OpenClaw responses (when trace data exists — nothing is fabricated)
- Flow-level savings summaries (when companion flow data exists)
- Security notices that **do not** interrupt flows
- Spectyra status and controls (`spectyra.status`, dashboard link, optimization toggle)

## Security notices are non-blocking

Spectyra shows **warnings only**. It does **not** stop prompts, cancel tool calls, pause autonomous agent flows, or require “Proceed anyway” confirmations. Prompt text is **never** auto-replaced by this plugin.

## Autonomous flow behavior

Spectyra security notices are **non-blocking (v1)**.

If Spectyra detects a possible secret, token, private key, internal URL, or risky tool action, it will show a warning and **continue** the OpenClaw flow. This keeps autonomous agent runs from being interrupted while still giving you visibility into possible prompt-security issues.

## Security model

Spectyra is local-first.

The plugin only connects to:

`http://127.0.0.1:4111`

This plugin does **not**:

- Proxy prompts through Spectyra cloud  
- Store provider API keys  
- Read arbitrary files  
- Execute shell commands  
- Install background services  
- Stop autonomous flows  

## Advanced setup

Prefer a global install and the `spectyra-companion` CLI:

```bash
npm install -g @spectyra/local-companion
spectyra-companion setup
spectyra-companion start --open
```

The dashboard opens at `http://127.0.0.1:4111/dashboard`.

## Publishing to ClawHub

Per [ClawHub](https://docs.openclaw.ai/tools/clawhub), `clawhub package publish <path>` accepts a **local folder** (or a zip, GitHub URL, etc.). You do **not** have to zip the plugin if your workflow uses a folder path.

1. From `packages/openclaw-plugin`, run `pnpm run build` so `dist/` exists (`openclaw.runtimeExtensions` points at `./dist/index.js`).
2. Confirm `package.json` includes the required `openclaw.compat` / `openclaw.build` metadata (see [Plugin setup and config](https://docs.openclaw.ai/plugins/sdk-setup)); bump `openclawVersion` / `pluginSdkVersion` / `compat.*` after you verify against your installed OpenClaw version.
3. Validate without uploading: `clawhub package publish /absolute/or/relative/path/to/openclaw-plugin --dry-run`
4. Publish the same path for real when ready.

The web publish flow should apply the same rules: a folder upload is the package root (contains `package.json`, `openclaw.plugin.json`, and built `dist/`).

## Troubleshooting

### Companion not running

Use Quick Start (`npx @spectyra/local-companion start --open`) or Advanced setup above.

### No inline savings showing

Inline savings appear only when the companion returns trace data for the response. The plugin never fabricates savings.

### Security warning appeared

Spectyra detected a possible secret, token, private key, internal URL, or risky pattern. The notice is **advisory** — review when you can; your flow has already continued.

## Development

```bash
pnpm --filter @spectyra/openclaw-plugin run build
pnpm --filter @spectyra/openclaw-plugin test
```

See also `SECURITY.md`, `PRIVACY.md`, and `PERMISSIONS.md`.
