---
name: spectyra
version: 1.0.12
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

## How optimization works (overview)

Before each vendor model call, the companion applies Spectyra’s **layered pipeline** to the outgoing request: structural normalization, handling of repeated context, flow-aware trimming, and other **size-safe** transforms. The goal is to drop wasted input while keeping the answer aligned with your intent. Each pass records **measurements** so the dashboard shows real deltas instead of hand-wavy estimates. Heuristic ordering and transform details live inside the companion binary; you still choose **`spectyra/*`** lanes and upstream models the same way as without Spectyra.

## Registry packaging

The bundled merge JSON only carries routing metadata: URL, surface kind, and the model table.
