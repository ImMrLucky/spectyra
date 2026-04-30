# @spectyra/devtools

Browser helpers for **Spectyra AI monitoring** (see `docs/SPECTYRA_AI_MONITOR_SPEC.md`).

- Re-exports the vanilla floating panel from `@spectyra/sdk` (`mountSpectyraDevtools`, `shouldMountDevtoolsByDefault`).
- Registers **`<spectyra-monitor-strip>`** — a Lit element that polls `GET {baseUrl}/__spectyra/monitor/summary` (Phase 6 dev bridge). Use in local dev with your Node server’s `createSpectyraDevBridgeConnectMiddleware`.

## Install

```bash
pnpm add @spectyra/devtools
```

## Lit strip

Split **frontend + API**? Load `GET {yourApi}/__spectyra/overlay-bootstrap.js` in `index.html` before this package so `baseUrl` is set automatically (see `@spectyra/auto` README).

```ts
import "@spectyra/devtools";

// In HTML (e.g. Vite dev index): baseUrl '' when same origin serves the bridge
document.body.innerHTML += '<spectyra-monitor-strip baseUrl=""></spectyra-monitor-strip>';
```

Attributes: `baseUrl` (default `""`), `poll-interval-ms` (default `3000`).

## Safety

The strip only fetches **summary JSON** (counts and USD rollups). It does not send provider keys.
