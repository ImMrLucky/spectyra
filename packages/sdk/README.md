# @spectyra/sdk

Local-first LLM cost optimization SDK.
Wrap your existing provider calls — Spectyra optimizes messages locally
and your code calls the provider directly. No proxy, no cloud dependency.

---

## Install

```bash
npm install @spectyra/sdk
```

**Requirements:** Node.js 18+, ESM environment.

---

## Quick Start

```ts
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY, // optional; omit = observe-only optimization
});

const openai = new OpenAI(); // your OPENAI_API_KEY

const { providerResult, report, promptComparison, flowSignals } = await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Summarize this document..." }],
    runContext: {
      project: "customer-support-ai",
      environment: process.env.NODE_ENV ?? "development",
      service: "api",
      workflowType: "chat",
    },
  },
  createOpenAIAdapter(),
);

console.log(providerResult);
console.log(report.estimatedSavings, report.inputTokensBefore, report.inputTokensAfter);
```

Subpath imports are also supported: `@spectyra/sdk/adapters/openai`, `.../anthropic`, `.../groq`.

---

## Production analytics (optional)

For **aggregate** savings in the Spectyra app (by project and environment), enable cloud telemetry — still **no prompt bodies** and no provider secrets:

```ts
const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  telemetry: { mode: "cloud_redacted" },
  spectyraCloudApiKey: process.env.SPECTYRA_CLOUD_API_KEY, // or SPECTYRA_API_KEY
  spectyraApiBaseUrl: process.env.SPECTYRA_API_BASE_URL, // must include `/v1`
});
```

Each `complete()` sends token/cost aggregates plus a bounded **`diagnostics`** object (see `buildSpectyraProductionDiagnostics` / `SpectyraProductionDiagnostics` in this package). Use `runContext.project` (and a project-scoped API key when required) so rows land in the right project.

Default `telemetry.mode` is **`local`**: nothing is POSTed to Spectyra regardless of API keys.

---

## How It Works

1. **You create a Spectyra instance** with a run mode (`off`, `observe`, `on`).
2. **You call `spectyra.complete()`**, passing your provider client, model,
   and messages plus a provider adapter.
3. **Spectyra optimizes messages locally** (whitespace normalization,
   deduplication, context trimming) — nothing leaves your machine.
4. **The adapter calls the provider directly** with your API key.
5. **You get back** `providerResult`, a `SavingsReport` (`report`), and optional `promptComparison` / `flowSignals`.

```
Your code → spectyra.complete() → local optimization → provider adapter → LLM provider
                                                                              ↓
                                                        report ← response
```

---

## Local browser dashboard (product split)

- **`@spectyra/local-companion`** is the **OpenClaw** local HTTP + browser UI (install/launch from the OpenClaw docs). It is **not** the recommended or documented path for **in-app `@spectyra/sdk`** embeds, so we do not point in-app SDK users at that package.
- **In-app SDK** visibility today: inspect `complete()` return values, logs, `startSpectyraSession`, and optional **`sdkEventEngine`** / summary helpers below. A **separate** optional localhost dashboard for companies embedding the SDK is **planned** under a distinct package (working name: **`@spectyra/inapp-local-companion`**) with its own release cadence — not published yet.

---

## Moat analytics (Phases 3–4)

The SDK emits the same normalized **`SpectyraEvent`** stream as Local Companion (`sdkEventEngine`). You can build **execution-graph** and **state-delta** summaries in-process (equivalent to `GET /v1/analytics/execution-graph/summary` and `GET /v1/analytics/state-delta/summary` on the companion):

```ts
import {
  moatPhase34SummariesFromSdkBuffer,
  moatPhase34SummariesFromEvents,
} from "@spectyra/sdk";
import type { SpectyraEvent } from "@spectyra/event-core";

const fromBuffer = moatPhase34SummariesFromSdkBuffer();
console.log(fromBuffer.executionGraph.stepOrder, fromBuffer.stateDelta.transitionCount);

// Or from any `SpectyraEvent[]`:
const events: SpectyraEvent[] = [/* ... */];
const custom = moatPhase34SummariesFromEvents(events);
```

---

## Workflow policy (Phase 6)

Local Companion evaluates **workflow policy** before each upstream provider call (`SPECTYRA_WORKFLOW_POLICY=enforce` by default). The SDK exposes the same evaluator and optional enforcement on `complete()`:

```ts
import {
  createSpectyra,
  workflowPolicySummaryFromSdkBuffer,
  WorkflowPolicyBlockedError,
} from "@spectyra/sdk";

// Read-only summary (same idea as GET /v1/analytics/workflow-policy/summary on the companion)
const policy = workflowPolicySummaryFromSdkBuffer("observe");

// Match desktop/companion default: block the provider when rules trip
const spectyra = createSpectyra({
  runMode: "on",
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  workflowPolicy: { mode: "enforce" },
});

try {
  await spectyra.complete(input, adapter);
} catch (e) {
  if (e instanceof WorkflowPolicyBlockedError) {
    console.error(e.result.violations);
  }
  throw e;
}
```

---

## Model aliases (`spectyra/smart`, `spectyra/fast`)

The companion resolves OpenClaw-style model ids to your real provider models. The SDK re-exports the same helpers:

```ts
import { resolveSpectyraModel, defaultAliasModels } from "@spectyra/sdk";

const aliases = defaultAliasModels("openai");
const { provider, upstreamModel, requestedModel } = resolveSpectyraModel("spectyra/smart", {
  provider: "openai",
  aliasSmartModel: aliases.smart,
  aliasFastModel: aliases.fast,
  aliasQualityModel: aliases.quality,
});
```

---

## Run Modes

| Mode | Optimization | Provider Call | Use Case |
|------|-------------|---------------|----------|
| `off` | None | Direct | Pass-through / debugging |
| `observe` | Applied locally | **None** | Estimate savings without spending tokens |
| `on` | Applied locally | Direct (optimized messages) | Production — real savings |

```ts
const spectyra = createSpectyra({ runMode: "on" }); // default when omitted
// const spectyra = createSpectyra({ runMode: "observe" }); // dry-run / projected savings
```

---

## Provider Adapters

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

## API Reference

### `createSpectyra(config?)`

Creates a Spectyra instance.

```ts
const spectyra = createSpectyra({
  runMode: "on", // "off" | "observe" | "on" (default: "on")
  telemetry: { mode: "local" }, // "off" | "local" | "cloud_redacted"
  promptSnapshots: "local_only", // "none" | "local_only" | "cloud_opt_in"
  licenseKey: process.env.SPECTYRA_LICENSE_KEY,
  spectyraCloudApiKey: process.env.SPECTYRA_CLOUD_API_KEY,
  spectyraApiBaseUrl: process.env.SPECTYRA_API_BASE_URL,
});
```

### `spectyra.complete(input, adapter)`

The primary API. Optimizes messages locally, then calls the provider.

**Parameters:**
- `input.provider` — Vendor string (e.g. `"openai"`)
- `input.client` — Your provider SDK client instance
- `input.model` — Model name (e.g. `"gpt-4o-mini"`)
- `input.messages` — Array of `{ role, content }` messages
- `input.runContext` — Optional `project`, `environment`, `service`, `workflowType`, `sessionId`, `traceId`
- `adapter` — Provider adapter from `createOpenAIAdapter()` etc.

**Returns:** `SpectyraCompleteResult`
- `providerResult` — Raw provider response
- `report` — `SavingsReport` (tokens, costs, transforms, hints)
- `promptComparison` — Summaries for local debugging when prompt snapshots are enabled
- `flowSignals` — Flow analysis signals when available

### `spectyra.agentOptions(ctx, prompt)` *(local mode)*

Returns agent framework options (model selection, tool gating, budget).
Synchronous, no API call.

### `spectyra.agentOptionsRemote(ctx, promptMeta)` *(deprecated)*

Fetches options from Spectyra API. Deprecated — prefer `complete()`.

---

## SavingsReport

The authoritative shape is `SavingsReport` from `@spectyra/core-types` (re-exported from `@spectyra/sdk`). Highlights: `inputTokensBefore` / `inputTokensAfter`, `outputTokens`, `estimatedCostBefore` / `estimatedCostAfter`, `estimatedSavings`, `estimatedSavingsPct`, `transformsApplied`, optional `contextReductionPct`, `duplicateReductionPct`, `flowReductionPct`, `messageTurnCount`, `repeatedContextTokensAvoided`, `repeatedToolOutputTokensAvoided`, `runId`, `createdAt`.

---

## Release verification

Before publishing, follow **`RELEASE.md`** in this package (build → `npm pack` → inspect tarball → smoke imports).

---

## Security Defaults

| Concern | Default |
|---------|---------|
| Inference path | Direct to provider |
| Provider keys | Your key, never stored by Spectyra |
| Prompt storage | Local only (never uploaded) |
| Telemetry | Default `local` (no cloud POST). Use `cloud_redacted` + Spectyra API key for dashboards. |
| Cloud relay | None |

---

## Agent Wrappers

For agent framework integration, see `@spectyra/agents`:

```ts
import { wrapOpenAIInput } from "@spectyra/agents";

const result = await wrapOpenAIInput({
  messages,
  runMode: "observe",
  apiEndpoint: undefined, // fully local
});
```

---

## Legacy: `SpectyraClient`

`SpectyraClient` is deprecated. It routed calls through the Spectyra cloud
gateway. Prefer `createSpectyra().complete()` for direct-to-provider calls.

```ts
// DEPRECATED — routes through Spectyra cloud
import { SpectyraClient } from "@spectyra/sdk";
const client = new SpectyraClient({ ... });
```

---

## Troubleshooting

### Verify installation

```bash
node -e "import('@spectyra/sdk').then(m => console.log('exports:', Object.keys(m)))"
```

### "SDK access is disabled"

Your org's SDK access is controlled in Settings. An admin can enable it.

---

## Cloud account management (REST, browser session)

Custom apps can call the Spectyra API with a **Supabase JWT** (`Authorization: Bearer …`) on the `/v1/account/*` routes:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/account/summary` | Access state, owned subscriptions, cancel flags |
| POST | `/v1/account/subscription/cancel-at-period-end` | Stop renewal after current period |
| POST | `/v1/account/subscription/keep` | Undo scheduled cancellation |
| POST | `/v1/account/pause-service` | Pause account (same semantics as dashboard) |
| POST | `/v1/account/resume-service` | Reactivate |
| POST | `/v1/account/delete` | Body `{ "confirm": "DELETE_MY_ACCOUNT" }` — irreversible |

Base URL is your deployed API (e.g. `https://…/v1`). End users typically use the web app **Plan & licensing** page or the Local Companion `spectyra-companion account` command.

---

## License

MIT
