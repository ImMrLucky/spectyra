# Spectyra — OpenClaw Skill

Automatic token optimization for OpenClaw. Reduces AI costs by routing requests through Spectyra's Local Companion.

**ClawHub / OpenClaw skills:** the published artifact is **`SKILL.md`** (YAML frontmatter + body). Files like `skill.json` / `setup.sh` are legacy extras for older merge-based installers and are not what OpenClaw’s skill index consumes.

**Reviewers:** see **`SECURITY.md`** (network boundaries, provider keys, payments).

## Install

```bash
openclaw skills install spectyra
```

## Setup

You need a **Spectyra account** (email + password) and a **Spectyra API key** — that’s all OpenClaw needs for identity and your Spectyra workspace (one workspace per account on the server; you don’t configure orgs). Optional paid access is managed on **spectyra.ai**, not in this shell script. Install the companion and run guided setup:

```bash
npm install -g @spectyra/local-companion
spectyra-companion setup
```

That flow signs you up or in and saves your provider key + OpenClaw wiring. Details are in **`SKILL.md`**.

## Usage

```bash
spectyra-companion start --open
```

Then use OpenClaw with **`spectyra/smart`** (see **http://127.0.0.1:4111/dashboard** for savings).

Savings **vary by workload**. Use the local dashboard to measure real runs; optionally run `node scripts/benchmark-savings.mjs` from the companion package for a one-shot sanity check.

## What it does

When installed, this skill documents how to:

1. Run the **Local Companion** from **`npm install -g @spectyra/local-companion`**
2. **Point OpenClaw** at `http://127.0.0.1:4111/v1` (via **`spectyra-companion setup`**)
3. Use model aliases: **`spectyra/smart`**, **`spectyra/fast`**, **`spectyra/quality`**

## Requirements

- **OpenClaw** installed and working
- **Spectyra account + Spectyra API key** (email/password — created or signed in via **`spectyra-companion setup`** or the web app)
- **`@spectyra/local-companion`** on your PATH (`npm install -g @spectyra/local-companion`)
- **LLM provider API key** on disk — configured during **`spectyra-companion setup`**

## See savings

With the companion running, open **http://127.0.0.1:4111/dashboard** or run:

```bash
spectyra-companion start --open
# or, if already running:
spectyra-companion dashboard
```

## How it works

```
Your OpenClaw Agent
    ↓ uses spectyra/smart
Spectyra Local Companion (localhost:4111)
    ↓ optimizes tokens, caches, routes
Your AI Provider (OpenAI, Anthropic, Groq)
    ↓
Response (optimized, cheaper)
```

- Inference stays local; your provider key is not sent to Spectyra for chat.
- Savings show on the **local dashboard** at `/dashboard` (served by the companion).

## Quick start (minimal)

```bash
openclaw skills install spectyra
npm install -g @spectyra/local-companion
spectyra-companion setup
spectyra-companion start --open
```

Then use OpenClaw with **`spectyra/smart`** (Control UI, gateway, or e.g. `openclaw chat`).

## One-line setup (OpenClaw + Spectyra together)

If you don't have OpenClaw yet, you can use the installer from [spectyra.ai/install.sh](https://spectyra.ai/install.sh). **Prefer reviewing the script before executing it** (same pattern as in `SKILL.md`), or install OpenClaw and this skill via npm as documented above.

Then run `spectyra-companion setup` and `spectyra-companion start --open` before chatting.

## See also (not required for this skill)

- **[Spectyra Desktop](https://spectyra.ai/download)** — alternative installer and in-app OpenClaw wizard.
- **`@spectyra/sdk`** — embed optimization in your own app; savings on each call as `SavingsReport`.

## Uninstall

```bash
openclaw skills uninstall spectyra
```

This removes the Spectyra provider from your OpenClaw config. Your AI provider key and Spectyra account are not affected.
