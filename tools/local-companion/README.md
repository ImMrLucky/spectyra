# @spectyra/local-companion

**OpenClaw / local-first companion** — runs on your machine and exposes a small HTTP API so OpenClaw can use Spectyra-style tools (browser, canvas, skills, etc.) without sending your traffic through Spectyra’s cloud.

**Anonymous and free for OpenClaw.** No Spectyra account is required. Optional Spectyra account features are separate from this package.

- **npm:** [https://www.npmjs.com/package/@spectyra/local-companion](https://www.npmjs.com/package/@spectyra/local-companion)

## Requirements

- **Node.js 20+**
- **pnpm** (recommended) or npm

## Install

```bash
npm install -g @spectyra/local-companion
# or
pnpm add -g @spectyra/local-companion
```

Or run without a global install:

```bash
npx @spectyra/local-companion start
```

## Run

Start the companion (default host `127.0.0.1`, port `18789`):

```bash
spectyra-companion start
```

Useful flags:

```bash
spectyra-companion start --host 127.0.0.1 --port 18789
spectyra-companion start --dashboard-host 127.0.0.1 --dashboard-port 18790
```

Stop:

```bash
spectyra-companion stop
```

Status:

```bash
spectyra-companion status
```

From a clone of this repo:

```bash
cd tools/local-companion
pnpm install
pnpm run build
pnpm exec spectyra-companion start
```

## OpenClaw

Point OpenClaw at the local companion base URL (default `http://127.0.0.1:18789`). The companion speaks the same local HTTP surface OpenClaw expects for tool routing and optional dashboard.

**Environment (optional)**

| Variable | Purpose |
|----------|---------|
| `SPECTYRA_OPENCLAW_FREE` | When `true` / unset / empty, OpenClaw free mode (default). Set to `false` or `0` only if you intentionally want non–OpenClaw-free behavior. |
| `SPECTYRA_COMPANION_API_KEY` | Optional API key the server requires on requests. |
| `SPECTYRA_COMPANION_LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error` (default `info`). |

## What runs locally

Typical local HTTP surface (paths may vary slightly by version; see `/health` after start):

| Path | Role |
|------|------|
| `GET /health` | Liveness |
| `GET /dashboard` | Small local dashboard (if enabled) |
| `POST /v1/chat/completions` | Chat completions proxy surface used by the agent stack |

Everything above is **on your machine** unless you configure upstream models yourself.

## Optional Spectyra cloud

If you use a Spectyra account elsewhere, that is **optional** and not required to install or run this package. This README does not document cloud billing or subscription APIs; those are unrelated to anonymous OpenClaw usage.

## Anonymous usage telemetry

When OpenClaw free mode is on (default), the companion may send **minimal** anonymous telemetry (e.g. install ping, coarse usage events) to Spectyra so we can see aggregate adoption. **No API keys, prompts, or tool payloads** are included. Disable by setting `SPECTYRA_OPENCLAW_FREE=false` or `0` (not recommended unless you know you need it).

State file (installation id, etc.): `~/.spectyra/companion/state.json`.

## Security notes

- Bind to `127.0.0.1` unless you understand the exposure of opening the port on your LAN.
- Prefer `SPECTYRA_COMPANION_API_KEY` if anything other than localhost can reach the process.

## License

MIT — see the Spectyra repository [LICENSE](https://github.com/ImMrLucky/spectyra/blob/main/LICENSE).
