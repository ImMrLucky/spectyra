# Spectyra — OpenClaw Skill

Automatic token optimization for OpenClaw. Reduces AI costs by routing requests through Spectyra's Local Companion.

## Install

```bash
openclaw skills install spectyra
```

## Two paths

| You already have… | What to do |
|-------------------|------------|
| **OpenClaw** | `npm i -g @spectyra/local-companion` → `spectyra-companion setup` → `spectyra-companion start --open` → use OpenClaw with `spectyra/smart` |
| **Spectyra account / Desktop** | Install [Spectyra Desktop](https://spectyra.com/download) → run the **OpenClaw** setup wizard → use **Live** or **http://127.0.0.1:4111/dashboard** for savings |

Savings **vary by workload**. Measure with the local dashboard and, from the companion package, `node scripts/benchmark-savings.mjs` (one-shot test request).

## What it does

When installed, this skill documents how to:

1. Run the **Local Companion** (`spectyra-companion` from npm, or via Spectyra Desktop)
2. **Point OpenClaw** at `http://127.0.0.1:4111/v1`
3. Use model aliases: **`spectyra/smart`**, **`spectyra/fast`**, **`spectyra/quality`**

## Requirements

- **OpenClaw** installed and working (Path A), or install it via Spectyra Desktop wizard (Path B)
- **`@spectyra/local-companion`** on your PATH (`npm install -g @spectyra/local-companion`) **or** [Spectyra Desktop](https://spectyra.com/download) (it starts the same companion)
- **Provider API key** on disk — `spectyra-companion setup` or the Desktop wizard

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

## Quick start

```bash
openclaw skills install spectyra
npm install -g @spectyra/local-companion
spectyra-companion setup
spectyra-companion start --open
openclaw chat
```

## One-line setup (OpenClaw + Spectyra together)

If you don't have OpenClaw yet:

```bash
curl -fsSL https://spectyra.com/install.sh | bash
```

Then start the companion (`spectyra-companion start --open` or Desktop) before chatting.

## Uninstall

```bash
openclaw skills uninstall spectyra
```

This removes the Spectyra provider from your OpenClaw config. Your AI provider key and Spectyra account are not affected.
