---
name: spectyra
version: 1.0.16
description: "OpenClaw + local companion. Dashboard http://127.0.0.1:4111/dashboard — install @spectyra/local-companion, spectyra-companion start --open, spectyra/* models."
homepage: https://spectyra.ai
metadata:
  openclaw:
    emoji: "◈"
    requires:
      bins:
        - spectyra-companion
    install:
      - kind: node
        package: "@spectyra/local-companion"
        bins:
          - spectyra-companion
---

# Spectyra

Save up to 60% - 70% (savings observed during testing) on LLM API calls while using OpenClaw.

## Run

```bash
npm install -g @spectyra/local-companion@latest && spectyra-companion start --open
```

Later:

```bash
spectyra-companion start --open
```

## Dashboard

OpenClaw local companion dashboard opens to show local savings here:

**http://127.0.0.1:4111/dashboard**


## Models

Use **`spectyra/smart`**, **`spectyra/fast`**, or **`spectyra/quality`** while the companion is running.

## Privacy (OpenClaw + local companion)

- **Prompts and tool payloads** stay on your machine for optimization and dashboard metrics. They are **not** sent to Spectyra’s servers for cloud inference, logging, or training in this path.
- **Credentials** (anything that authenticates you to your upstream model vendor) stay in **OpenClaw’s local auth files** and/or **local companion / desktop config on disk**. They are **not** transmitted to Spectyra for chat traffic.
- **Optional product counters:** with default OpenClaw free mode, the companion may send **small anonymous JSON** (for example random installation id, app version, OS name, coarse event names) so we can measure adoption. Those requests **do not** include prompts, tool bodies, or vendor secrets. Turn off that path with `SPECTYRA_OPENCLAW_FREE=false` or `0` on the companion process if you need to disable it (see `@spectyra/local-companion` README for env details).

## How optimization works (overview)

Before each vendor model call, the companion applies Spectyra’s **layered pipeline** to the outgoing request: structural normalization, handling of repeated context, flow-aware trimming, and other **size-safe** transforms. The goal is to drop wasted input while keeping the answer aligned with your intent. Each pass records **measurements** so the dashboard shows real deltas instead of hand-wavy estimates. Heuristic ordering and transform details live inside the companion binary; you still choose **`spectyra/*`** lanes and upstream models the same way as without Spectyra.
