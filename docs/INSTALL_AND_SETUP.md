# Install Spectyra (no source build)

This guide is for **end users** who should not need to clone the repo or run `pnpm make`.

---

## Choose your path

| You are… | Easiest install | What you get |
|----------|-----------------|--------------|
| **Non-developer** — want a window, keys, local dashboard | [**Desktop app**](#desktop-app-download) | GUI + embedded companion (no terminal) |
| **OpenClaw / Claude Code / any “set base URL” tool** | [**Local Companion**](#local-companion-one-command) | OpenAI-compatible server on `localhost` |
| **Building an app** | [**SDK on npm**](#sdk-npm) | `npm install @spectyra/sdk` + a few lines of code |

---

## Desktop app (download)

**Goal:** Double-click an installer — no Node, no clone.

1. Open **[GitHub Releases](https://github.com/spectyra/spectyra/releases)** for this repository.
2. Download the latest **`Spectyra-*.dmg`** (macOS) or **`.exe` / zip** (Windows) attached to the release.
3. Install like any normal app.
4. On first launch, the app walks you through **provider API keys** (BYOK) and optional **license** activation.

> **Maintainers:** Push a tag `desktop-v*` (e.g. `desktop-v1.0.0`) to run [`.github/workflows/release-desktop.yml`](../.github/workflows/release-desktop.yml), then attach the **Artifacts** from the workflow to [GitHub Releases](https://github.com/spectyra/spectyra/releases) (or extend the workflow with `softprops/action-gh-release`). Until assets are published, users can rely on [Local Companion](#local-companion-one-command) (no GUI).

---

## Local Companion (one command)

**Goal:** Point OpenClaw, env vars, or any OpenAI-compatible client at `http://127.0.0.1:4111/v1` — **no app code changes**.

### Prerequisites

- [Node.js 18+](https://nodejs.org/) installed (LTS is fine).

### Install & run

**Option A — `npx` (nothing global):**

```bash
npx @spectyra/local-companion
```

**Option B — global CLI (run `spectyra-companion` anywhere):**

```bash
npm install -g @spectyra/local-companion
spectyra-companion
```

> Publishing `@spectyra/local-companion` to npm is required for these commands to work for users who don’t use this monorepo. Until then, clone the repo and run `pnpm install && pnpm --filter @spectyra/local-companion exec tsx src/companion.ts` from `tools/local-companion`, or use the **Desktop app**.

Default URL: **`http://127.0.0.1:4111`**

Health check: `curl http://127.0.0.1:4111/health`

### Configure your tool (OpenClaw-style)

1. Start the companion (see above).
2. Set the **OpenAI-compatible base URL** to the companion:

   ```bash
   export OPENAI_BASE_URL=http://127.0.0.1:4111/v1
   ```

   Or set the same value in your tool’s UI (API base URL / custom endpoint).

3. Keep using your **normal provider API key** (OpenAI, Groq, etc.) — the companion forwards to the provider; Spectyra does not replace your key.

4. Optional: set **mode** (off / observe / on) via companion config or Desktop — see [USER_GUIDE.md](./USER_GUIDE.md).

More detail: [`tools/local-companion/README.md`](../tools/local-companion/README.md).

---

## SDK (npm)

**Goal:** Optimize inside your Node/TS app with a few lines of code.

```bash
npm install @spectyra/sdk
```

```typescript
import { createSpectyra } from "@spectyra/sdk";
import { createOpenAIAdapter } from "@spectyra/sdk/adapters/openai";
import OpenAI from "openai";

const spectyra = createSpectyra({ runMode: "observe" }); // or "on"
const openai = new OpenAI();

const result = await spectyra.complete(
  { client: openai, model: "gpt-4o-mini", messages: [{ role: "user", content: "Hello" }] },
  createOpenAIAdapter(openai),
);
```

Full API: [`packages/sdk/README.md`](../packages/sdk/README.md).

---

## Quick comparison

| Method | Code changes | Prompts leave your machine? |
|--------|----------------|-----------------------------|
| Desktop | None | No |
| Local Companion | None (env / base URL only) | No |
| SDK | Small wrapper | No |

---

## Troubleshooting

- **Companion won’t start:** Check port `4111` is free; change port in companion config if needed.
- **401 from provider:** Your provider key must be set in the Desktop app, companion env, or tool — Spectyra forwards with **your** key.
- **Need help:** See [USER_GUIDE.md](./USER_GUIDE.md) and [README.md](../README.md).
