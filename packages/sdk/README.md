# @spectyra/sdk

Wrap your existing LLM calls: Spectyra optimizes prompts **locally**, then your code calls OpenAI, Anthropic, or Groq **directly**—no proxy, no extra round-trip.

**Phased execution:** [../../docs/sdk/PHASED_CHECKLIST.md](../../docs/sdk/PHASED_CHECKLIST.md) · **Feature matrix:** [../../docs/sdk/SPEC_CHECKLIST.md](../../docs/sdk/SPEC_CHECKLIST.md) · **Integration modes:** [../../docs/sdk/README.md](../../docs/sdk/README.md) · **Language scaffolds:** [../../sdks/](../../sdks/).

---

## Development vs production

**Local / dev**

- Turn on **`debug: true`** and **`logLevel: "info"`** (or `"debug"`) so savings, quota, and entitlement refreshes are visible in the console.
- In the browser, leave **`devtools`** enabled (default) for the floating panel; set **`devtools.defaultOpen: true`** if you want the card expanded on first load.
- Use a **Spectyra API key** pointed at **staging** if you have one; entitlements and pricing snapshots will refresh on the interval from config.

**Production**

- Keep **`spectyraCloudApiKey`** (or `SPECTYRA_API_KEY`) and **`spectyraApiBaseUrl`** set so `GET /v1/entitlements/status` and `GET /v1/pricing/snapshot` can refresh **without redeploy** when the customer upgrades billing.
- Set **`devtools.enabled: false`** if you do not want the floating panel in production UIs.
- Set **`productSurface: "in_app"`** (default) so user-facing strings follow the in-app / billing wording rather than legacy OpenClaw-oriented copy.

```ts
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  spectyraApiBaseUrl: process.env.SPECTYRA_API_BASE_URL, // must include /v1
  productSurface: "in_app",
  debug: process.env.NODE_ENV !== "production",
  logLevel: process.env.NODE_ENV !== "production" ? "info" : "warn",
  devtools: { enabled: process.env.NODE_ENV !== "production" },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
```

---

## Install (30 seconds)

```bash
npm install @spectyra/sdk openai
```

You also need the official provider SDK (here `openai`); the same pattern works with `@anthropic-ai/sdk` and `groq-sdk`.

**Requirements:** Node.js 18+, ESM (`"type": "module"` or use `.mjs`).

---

## Minimum setup: wrap one call

1. **Create a Spectyra instance** (defaults are enough to start).
2. **Pass your provider client**, model, and messages into `complete()`.
3. **Use a small adapter** so Spectyra knows how to call your provider.

```ts
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const spectyra = createSpectyra({
  // runMode defaults to "on"
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const { providerResult, report } = await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello!" }],
  },
  createOpenAIAdapter(),
);

// Same response object you would get from the provider SDK, plus a savings report
console.log(report.estimatedSavingsPct, report.inputTokensBefore, report.inputTokensAfter);
```

### Callback style: `run()` (no provider client object)

Use `spectyra.run()` when you want Spectyra to optimize messages, then **you** call the provider in a callback (same BYOK and privacy rules as `complete()`):

```ts
const out = await spectyra.run(
  { provider: "openai", model: "gpt-4o-mini", messages: [{ role: "user", content: "Hi!" }] },
  async ({ messages, model }) => {
    const res = await openai.chat.completions.create({ model, messages });
    const text = res.choices[0]?.message?.content ?? "";
    return {
      result: res,
      text,
      usage: {
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
      },
    };
  },
);

console.log(out.savingsPercent, out.quotaStatus, out.optimizationActive);
```

Aggregates for this instance: `spectyra.getSessionCostSummary()`, `spectyra.getSavingsSummary()`, `spectyra.getQuotaStatus()`.

**Subpath imports:** `@spectyra/sdk/adapters/openai`, `.../anthropic`, `.../groq`.

**Optional: file license key**  
If you use a Spectyra **file** license (e.g. with the desktop / companion flow), add `licenseKey: process.env.SPECTYRA_LICENSE_KEY` to `createSpectyra`. For most **cloud** setups, prefer a **Spectyra API key** and `SPECTYRA_API_BASE_URL` in the next section instead of (or in addition to) a file key.

---

## Recommended: Spectyra API key (account, quotas, dashboards)

To tie usage to your Spectyra org—**plan, quotas, aggregate telemetry, and in-browser devtools**—add your **Spectyra** API key and API base URL (include `/v1`):

```bash
export SPECTYRA_API_KEY="sp_..."          # or SPECTYRA_CLOUD_API_KEY
export SPECTYRA_API_BASE_URL="https://your-api.example.com/v1"
```

```ts
const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY, // or SPECTYRA_CLOUD_API_KEY; you can also use `apiKey` if you are not on legacy `mode: "api"`
  spectyraApiBaseUrl: process.env.SPECTYRA_API_BASE_URL,
  telemetry: { mode: "cloud_redacted" }, // optional: redacted project rollups in the Spectyra app
  // entitlements default to on when a key + base URL can be resolved; polls GET /v1/entitlements/status
});
```

Add `project` and `environment` on **`complete()`**, not on `createSpectyra`:

```ts
await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "…" }],
    runContext: { project: "my-app", environment: "production" },
  },
  createOpenAIAdapter(),
);
```

- **Entitlements** refresh in the background (a plan or quota change in the **Spectyra web app** applies without redeploying your code).
- **Free-tier / quota** limits: optimization can pause while your app keeps calling the provider; see `getQuotaStatus()` and the floating panel below.

`telemetry` defaults to `"local"` (no HTTP to Spectyra from telemetry). Set `cloud_redacted` only when you want redacted rollups; prompts still never leave the host.

---

## What you get beyond the minimal example

| Topic | When you need it |
|--------|------------------|
| [Observability (logs, hooks, getters)](#observability) | Custom UI, debug, “proof of savings” in your app |
| [Devtools (browser)](#browser-devtools) | Default floating panel in the browser; set *devtools.enabled* to *false* to hide |
| [Run modes](#run-modes) | `on` (default) vs `off` (passthrough); plan / quota via [entitlements](#recommended-spectyra-api-key-account-quotas-dashboards) |
| [Adapters (Anthropic, Groq)](#provider-adapters) | Same `complete()` pattern, different adapter |
| [Cloud telemetry & `runContext`](#cloud-telemetry) | `project`, `environment`, and redacted POSTs to `/v1/telemetry/run` |
| [Workflow policy, sessions, events](#advanced-topics) | Parity with Local Companion for policy and analytics |

---

## Observability

**Config:** `debug`, `logLevel` (`"silent" \| "error" \| "warn" \| "info" \| "debug"`), and optional `logger` (e.g. subset of `console`).

**Callbacks on `createSpectyra`:** `onRequestStart`, `onRequestEnd`, `onOptimization`, `onMetrics`, `onQuota`, `onEntitlementChange` (and reserved hooks for a future cost engine: `onCostCalculated`, `onPricingStale`).

**Getters on the instance:**

- `getSessionStats()` — cumulative in-process metrics
- `getSavingsSummary()` — savings-focused rollup
- `getQuotaStatus()` / `getEntitlementStatus()` — after entitlements are loaded
- `getLastRun()` — last `complete()` summary
- `refreshEntitlement()` — manual refetch
- `mountDevtools()` — mount the panel if you disabled auto-mount (browser only)

---

## Browser devtools

In **browser** runtimes, a small **Spectyra** panel can appear (compact + “Full details”, minimizable) so you can demo savings without another package. Turn it off with:

```ts
createSpectyra({ devtools: { enabled: false } });
```

`shouldMountDevtoolsByDefault` is exported for advanced bundling setups.

---

## How it works

1. You call **`spectyra.complete(input, adapter)`** with your client, model, and messages.
2. **Spectyra optimizes the prompt locally** (deduplication, trimming, etc.); with default settings, your content stays in-process.
3. The **adapter** performs the real HTTP call to the provider with **your** API key.
4. You get **`providerResult`**, a **`SavingsReport`** (`report`), and optional **`promptComparison`** / **`flowSignals`**.

```text
Your app → complete() → local optimization → adapter → LLM
                              ↑________________________|
                            report, savings
```

---

## Run modes

| `runMode` | Behavior |
|-----------|----------|
| **`on`** (default) | Apply optimizations, then call the provider. |
| **`off`** | No optimization; direct provider call. |
| **`observe`** | Pipeline runs; projected / observe semantics for comparison (useful for safe estimates). |

---

## Cloud telemetry

**Aggregate** usage in the Spectyra app (by project and environment) without sending raw prompts:

```ts
const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  telemetry: { mode: "cloud_redacted" },
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  spectyraApiBaseUrl: process.env.SPECTYRA_API_BASE_URL, // e.g. https://api.../v1
});

// On each call:
await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4o-mini",
    messages,
    runContext: {
      project: "customer-support-ai",
      environment: process.env.NODE_ENV ?? "development",
    },
  },
  createOpenAIAdapter(),
);
```

Use a **project-scoped API key** when your org requires it so rows land in the right project. Default `telemetry.mode` is **`local`**: nothing is POSTed unless you opt in as above.

---

## Provider adapters

### OpenAI

```ts
import { createOpenAIAdapter } from "@spectyra/sdk/adapters/openai";
import OpenAI from "openai";

const openai = new OpenAI();
const adapter = createOpenAIAdapter();
```

### Anthropic

```ts
import { createAnthropicAdapter } from "@spectyra/sdk/adapters/anthropic";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const adapter = createAnthropicAdapter(anthropic);
```

### Groq (OpenAI-compatible)

```ts
import { createGroqAdapter } from "@spectyra/sdk/adapters/groq";
import Groq from "groq-sdk";

const groq = new Groq();
const adapter = createGroqAdapter(groq);
```

---

## API reference (short)

### `createSpectyra(config?)`

Common fields:

- `runMode` — `"off" \| "on"`.
- `licenseKey` — local license file key when you use that flow.
- `spectyraCloudApiKey` — Spectyra `X-SPECTYRA-API-KEY` (or env `SPECTYRA_CLOUD_API_KEY` / `SPECTYRA_API_KEY`, or `apiKey` in config when **not** using legacy `mode: "api"` for the old remote gateway).
- `spectyraApiBaseUrl` — REST base **including** `/v1` (e.g. `https://.../v1`); also read from `SPECTYRA_API_BASE_URL`.
- `telemetry: { mode }` — `"local"` (default) or `"cloud_redacted"`.
- `promptSnapshots` — `"none" \| "local_only" \| "cloud_opt_in"`.
- `devtools` — e.g. `{ enabled: true, defaultOpen: true, position: "bottom-right" }`.
- `entitlements` — e.g. `{ enabled: true, refreshIntervalMs: 120_000, baseUrl: "…/v1" }` (defaults align with the keys above).
- `debug` / `logLevel` / `logger`, plus lifecycle hooks listed under [Observability](#observability).

### `spectyra.complete(input, adapter)`

- `input.provider`, `input.client`, `input.model`, `input.messages` — required.
- `input.maxTokens` / `input.temperature` — passed through to the adapter when supported.
- `input.runContext` — optional: `project`, `environment`, `sessionId`, `runId` (for logs/hooks), `emitNormalizedEvents`, etc.

**Returns** `SpectyraCompleteResult`: `providerResult`, `report` (`SavingsReport`), optional `promptComparison`, `flowSignals`, and license-related fields when applicable.

### `spectyra.agentOptions(ctx, prompt)`

Local, synchronous agent-style options. No network.

### `spectyra.agentOptionsRemote(...)` (deprecated)

Legacy remote options; prefer `complete()`.

---

## Savings report

`SavingsReport` is defined in `@spectyra/core-types` and re-exported from this package. Highlights: `inputTokensBefore` / `inputTokensAfter`, `outputTokens`, `estimatedCostBefore` / `estimatedCostAfter`, `estimatedSavings`, `estimatedSavingsPct`, `transformsApplied`, `runId`, `createdAt`, optional analytics hints and `notes`.

---

## Advanced topics

**OpenClaw vs in-app** — The **`@spectyra/local-companion`** package is the **OpenClaw** HTTP + local UI. For **embedding in your own app**, you only need **`@spectyra/sdk`**; you do not need the companion to use `complete()`.

**Moat analytics (execution graph, state delta)**  
Use `moatPhase34SummariesFromSdkBuffer`, `moatPhase34SummariesFromEvents`, and `sdkEventEngine` (same event model as Local Companion). See the package exports.

**Workflow policy (Phase 6)**  
`workflowPolicy: { mode: "observe" \| "enforce" }` and `WorkflowPolicyBlockedError` for parity with the companion; see `workflowPolicySummaryFromSdkBuffer`.

**Model aliases** (`spectyra/smart`, `spectyra/fast`)  
Re-exported helpers: `resolveSpectyraModel`, `defaultAliasModels`, etc.

**`startSpectyraSession`**  
Multi-step workflow sessions and analytics.

**`@spectyra/agents`** (separate package)  
Higher-level `wrapOpenAIInput` and agent helpers; optional.

---

## Local browser dashboard

For **OpenClaw users**, the Local Companion install provides a local HTTP + browser experience—that flow is documented with **`@spectyra/local-companion`**, not required for the in-app SDK above.

---

## Legacy: `SpectyraClient`

`SpectyraClient` (deprecated) routed traffic through a Spectyra cloud gateway. **Prefer `createSpectyra().complete()`** for direct-to-provider calls.

---

## Security defaults

| Topic | Default |
|--------|--------|
| Data path | Your process → provider; no proxy by default |
| Provider API keys | Yours; not sent to Spectyra in the default path |
| Prompts | Not uploaded unless you opt into specific cloud features documented elsewhere |
| Telemetry | `local` unless you set `cloud_redacted` + API base + key |
| Entitlements / pricing | Fetched with your **Spectyra** API key when you configure a base URL |

---

## Cloud account (browser / JWT)

For interactive account management, the web app and authenticated REST routes under `/v1/account/*` (Supabase `Authorization: Bearer …`) are documented in your deployment; typical paths include plan summary, pause, resume, and cancellation. The **SDK** uses the **API key** flow for `telemetry` and `GET /v1/entitlements/status` from server-side or embedded apps, not a separate “companion” account path.

---

## Release verification

Before publishing, follow **`RELEASE.md`** in this package (build → `npm pack` → smoke imports).

---

## License

MIT
