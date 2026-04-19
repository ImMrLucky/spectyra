# @spectyra/local-companion

**OpenClaw / local-first companion** — runs on your machine alongside of OpenClaw without sending your traffic through Spectyra’s cloud.

**Anonymous and free for OpenClaw.** No Spectyra account is required. Optional Spectyra account features are separate from this package.

Savings between 60% - 70% were observed during testing with OpenClaw.

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

## Run

Start the companion to see OpenClaw savings in real-time (launches in browser):

```bash
spectyra-companion start --open
```

Stop (ctrl-c process in terminal or cmd prompt) or run:

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

## What runs locally

Typical local HTTP surface (paths may vary slightly by version; see `/health` after start):

| Path | Role |
|------|------|
| `GET /health` | Liveness |
| `GET /dashboard` | Small local dashboard (if enabled) |
| `POST /v1/chat/completions` | Chat completions proxy surface used by the agent stack |

Everything above is **on your machine** unless you configure upstream models yourself.

## Anonymous usage telemetry

When OpenClaw free mode is on (default), the companion may send **minimal** anonymous telemetry (e.g. install ping, coarse usage events) to Spectyra so we can see aggregate adoption. **No API keys, prompts, or tool payloads** are included.

State file (installation id, etc.): `~/.spectyra/companion/state.json`.

## License

MIT — see the Spectyra repository [LICENSE](https://github.com/ImMrLucky/spectyra/blob/main/LICENSE).
