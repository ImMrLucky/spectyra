---
name: spectyra
version: 1.0.11
description: "OpenClaw + local companion. Dashboard: http://127.0.0.1:4111/dashboard — install @spectyra/local-companion, run spectyra-companion start --open, use spectyra/* models."
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

## Run

```bash
npm install -g @spectyra/local-companion@latest && spectyra-companion start --open
```

Later:

```bash
spectyra-companion start --open
```

## Dashboard

OpenClaw local companion dashboard (same as `start --open`):

**http://127.0.0.1:4111/dashboard**

If you set `SPECTYRA_PORT`, use that port instead of `4111`.

## Models

Use **`spectyra/smart`**, **`spectyra/fast`**, or **`spectyra/quality`** while the companion is running. Upstream keys: `spectyra-companion setup` if you need a guided step.
