# @spectyra/sdk

**Wrap your existing LLM call** and start seeing token and cost savings. Spectyra runs in your app’s **backend**, uses **your** provider keys, and returns the normal provider response **plus** a savings report—**no Spectyra inference proxy**.

- **Backend-first** — install where LLM calls already happen (API server, serverless, worker).
- **No prompt proxying** — optimization is local; the adapter calls OpenAI / Anthropic / Groq with your key.
- **BYOK** — provider API keys never go through Spectyra’s inference path by default.

---

## Get a Free Spectyra API key

You need a free **Spectyra API key** to enable savings, optimization, entitlements, and rollups in the Spectyra app. Create a free account and copy the key into **server-side** config: [spectyra.ai/register](https://spectyra.ai/register).

---

## TypeScript / Node.js quick start

Use this when calls run in a **Node.js** backend, **Next.js** API route, **Express** server, or **serverless** function. Install from npm — **no repo clone** required.

### 1. Install

```bash
npm install @spectyra/sdk openai
```

You also need the official **provider** package (`openai`, `@anthropic-ai/sdk`, or `groq-sdk`). **Node.js 18+** and **ESM** (`"type": "module"` or `.mjs`).

### 2. Add your Spectyra API key

Put the key in backend or hosting secrets, for example:

- Vercel / Netlify / Railway environment variables  
- AWS Secrets Manager, Azure Key Vault, GCP Secret Manager  
- Docker / Kubernetes secrets  
- Local `.env` for development only  

### 3. Wrap your existing LLM call

Use **`createSpectyra()`** and **`complete()`** with **`createOpenAIAdapter()`** — your code still calls OpenAI with **your** key.

```ts
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  productSurface: "in_app",
});

const { providerResult, report } = await spectyra.complete(
  {
    provider: "openai",
    client: openai,
    model: "gpt-4.1-mini",
    messages: [{ role: "user", content: "Summarize this support ticket…" }],
  },
  createOpenAIAdapter(),
);

console.log(providerResult);
// First "wow": savings live on `report`
console.log(
  `Saved: ${report.estimatedSavingsPct.toFixed(0)}% · $${report.estimatedSavings.toFixed(2)} estimated`,
);
```

After a successful run, console output can look like:

```text
Saved: 42% · $0.18 estimated
runId: a1b2c3d4-…
inferencePath: direct_provider
```

**Optional:** desktop / file-license flows can pass **`licenseKey: process.env.SPECTYRA_LICENSE_KEY`** to `createSpectyra`. Most cloud setups use **`spectyraCloudApiKey`** only.

---

## What you get back

`complete()` returns your normal provider object as **`providerResult`** plus a **`report`** (`SavingsReport`) with token and cost estimates.

```ts
{
  providerResult: /* same object OpenAI SDK returns */,
  report: {
    runId: "…",
    provider: "openai",
    model: "gpt-4.1-mini",
    inputTokensBefore: 12400,
    inputTokensAfter: 7100,
    outputTokens: 900,
    estimatedCostBefore: 0.42,
    estimatedCostAfter: 0.24,
    estimatedSavings: 0.18,
    estimatedSavingsPct: 42,
    inferencePath: "direct_provider",
    providerBillingOwner: "customer",
    transformsApplied: ["…"],
    // …plus telemetry / quality hints
  },
  security: { /* inferencePath, telemetryMode, … */ },
}
```

---

## Framework examples

Spectyra stays on the **server**; frontends call **your** API.

### Next.js API route

```ts
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  productSurface: "in_app",
});

export async function POST(req: Request) {
  const { messages } = await req.json();

  const { providerResult, report } = await spectyra.complete(
    { provider: "openai", client: openai, model: "gpt-4.1-mini", messages },
    createOpenAIAdapter(),
  );

  return Response.json({ response: providerResult, savings: report });
}
```

### Express

```ts
import express from "express";
import OpenAI from "openai";
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  productSurface: "in_app",
});

app.post("/api/chat", async (req, res) => {
  const { providerResult, report } = await spectyra.complete(
    { provider: "openai", client: openai, model: "gpt-4.1-mini", messages: req.body.messages },
    createOpenAIAdapter(),
  );

  res.json({ response: providerResult, savings: report });
});

app.listen(3000);
```

**Angular / React / etc.** — call your backend; keep **`complete()`** on the server with the same pattern as above.

---

## Browser / frontend usage

Most apps should install Spectyra in the **backend**, not the browser.

- Do **not** put OpenAI, Anthropic, Groq, or other **provider** API keys in frontend code.  
- Do **not** ship your private **Spectyra** API key in browser bundles.  

Reasonable browser uses: optional **savings overlay** during dev/QA (see below), client-safe summaries from **your** API, or apps where the browser only talks to **your** API—not the LLM provider directly.

---

## Dev / QA savings overlay

During development or QA you can enable the **floating panel** (token/cost rollups, latest run). **No raw prompts** are shown by default.

- In **production**, the overlay does **not** turn on from environment alone. Use explicit **`overlay: true`** or **`SPECTYRA_OVERLAY=true`** outside production, or **`devtools: { enabled: true }`** when debugging.  
- **`debug: true`** or **`SPECTYRA_DEBUG=true`** (non-production) prints **one-line** summaries after each `complete()`—savings % / estimated USD, passthrough reason, or `traceId` only. No messages, keys, or `Authorization` headers.

```ts
import { createSpectyra, createOpenAIAdapter } from "@spectyra/sdk";
import OpenAI from "openai";

const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  environment: process.env.APP_ENV || process.env.NODE_ENV,
  overlay: process.env.SPECTYRA_OVERLAY === "true",
  debug: process.env.SPECTYRA_DEBUG === "true",
  productSurface: "in_app",
});

spectyra.on("savings", (e) => {
  console.log("savings event", e.traceId, e.savingsPercent);
});
```

**Runtime helpers** on the same instance: `showOverlay()` / `hideOverlay()` / `toggleOverlay()`, `getSavings()` (summary + last run, no prompts), `on("savings", …)` (returns unsubscribe), `mountDevtools()` if you disabled auto-mount.

For production, keep **`overlay`** and **`debug`** off; you can always log from **`report`** after `complete()`.

---

## SDK API (what exists today)

- **`createSpectyra(config?)`** — pass **`spectyraCloudApiKey`** / **`SPECTYRA_API_KEY`** for cloud entitlements and optional redacted telemetry.  
- **`spectyra.complete(input, adapter)`** — primary path; pass your provider client plus e.g. **`createOpenAIAdapter()`**.  
- **`spectyra.run(input, execute)`** — callback style: you receive optimized messages and call the provider yourself.  
- **`getSavingsSummary()`**, **`getSessionCostSummary()`**, **`getSessionStats()`**, **`getLastRun()`**, **`getLastRunSavings()`**, **`getQuotaStatus()`**, **`getEntitlementStatus()`** — observability helpers.  
- **`refreshEntitlement()`** — manual entitlement refresh.  
- **`mountDevtools()`** — mount the floating panel (browser); often unnecessary if overlay auto-mounts.  
- **`showOverlay()`** / **`hideOverlay()`** / **`toggleOverlay()`** — control visibility.  
- **`getSavings()`** — `summary` + `lastRun` + `lastRunSavings` (no prompts).  
- **`on("savings", listener)`** — numeric post-run events; returns unsubscribe.  
- **`config.environment`**, **`config.overlay`**, **`config.debug`** — see [Dev / QA savings overlay](#dev-qa-savings-overlay).  
- **`createOpenAIAdapter()`** / **`createAnthropicAdapter()`** / **`createGroqAdapter()`** — from `@spectyra/sdk` or **`@spectyra/sdk/adapters/*`**.

**Not a separate alias API:** use **`complete()`** / **`run()`** (no standalone `optimize()` / `estimate()` / `flush()` in the SDK today).

### Optional: `run()` shape

```ts
const out = await spectyra.run(
  { provider: "openai", model: "gpt-4.1-mini", messages },
  async ({ messages, model }) => {
    const res = await openai.chat.completions.create({ model, messages });
    const text = res.choices[0]?.message?.content ?? "";
    const u = res.usage;
    return {
      result: res,
      text,
      usage: {
        inputTokens: u?.prompt_tokens ?? 0,
        outputTokens: u?.completion_tokens ?? 0,
      },
    };
  },
);

console.log(out.output);
console.log(out.savingsPercent, out.savingsAmount);
// Full savings report: out.complete.report
```

---

## Passthrough & fallback

- **`runMode: "off"`** — Spectyra skips optimization; your adapter still runs (killswitch).  
- **`runMode: "observe"`** — observe semantics; check **`report`** and version docs.  
- **Quota / entitlements** — when optimization is blocked, Spectyra can pass through so your app keeps working. Inspect **`report`**, **`licenseLimited`**, and **`getQuotaStatus()`**.

Redacted cloud telemetry (org rollups) is optional. With a Spectyra API key, **`telemetry.mode`** defaults to **`cloud_redacted`** unless you set **`telemetry: { mode: "local" }`**. Explicit production example:

```ts
const spectyra = createSpectyra({
  spectyraCloudApiKey: process.env.SPECTYRA_API_KEY,
  telemetry: { mode: "cloud_redacted" },
  productSurface: "in_app",
});
```

Add **`runContext`** on each **`complete()`** (not on `createSpectyra`) for **`project`** / **`environment`** in dashboards. REST defaults to **`https://spectyra.ai/v1`**; override with **`spectyraApiBaseUrl`** or **`SPECTYRA_API_BASE_URL`** only if your org uses a custom host.

Use **`productSurface: "openclaw_compat"`** only if you need legacy telemetry defaults. Prompts still never leave the host.

---

## Security notes

- Install Spectyra where LLM calls already happen (usually the **server**).  
- Keep **provider** keys and your **Spectyra** API key server-side.  
- Use deployment secrets or backend config; local **`.env`** only for development.  
- Avoid sending raw prompts in telemetry unless you explicitly design for that.

---

## FAQ

**Where should I install Spectyra?**  
On the service that already holds your **provider** credentials—typically your **API server**, not the browser.

**Do I need to clone the Spectyra repo?**  
No. Install **`@spectyra/sdk`** from npm.

**OpenClaw vs in-app SDK?**  
OpenClaw uses the **local companion** skill. In-app integration uses **`@spectyra/sdk`** inside *your* app. See [OpenClaw & Local Companion](https://spectyra.ai/openclaw) on the Spectyra site.

**Java, Go, or .NET?**  
Not covered by this package—call your **TypeScript** or **Node** service, or use another stack against Spectyra’s HTTP API where applicable.

---

## How it works

1. You call **`spectyra.complete(input, adapter)`** with your client, model, and messages.  
2. Spectyra **optimizes the prompt in-process** (dedupe, trim, etc.).  
3. The **adapter** calls the provider with **your** API key.  
4. You get **`providerResult`**, **`report`**, and optional extras (`promptComparison`, `flowSignals`).

```text
Your app → complete() → local optimization → adapter → LLM
                              ↑________________________|
                            report, savings
```

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

## More documentation (repo)

**Phased execution:** [../../docs/sdk/PHASED_CHECKLIST.md](../../docs/sdk/PHASED_CHECKLIST.md) · **Feature matrix:** [../../docs/sdk/SPEC_CHECKLIST.md](../../docs/sdk/SPEC_CHECKLIST.md) · **Integration modes:** [../../docs/sdk/README.md](../../docs/sdk/README.md) · **Language scaffolds:** [../../sdks/](../../sdks/).

---

## Observability (hooks & getters)

**Config:** `debug`, `logLevel` (`"silent" \| "error" \| "warn" \| "info" \| "debug"`), optional `logger`.

**Callbacks on `createSpectyra`:** `onRequestStart`, `onRequestEnd`, `onOptimization`, `onMetrics`, `onQuota`, `onEntitlementChange` (plus reserved hooks for a future cost engine).

**Devtools:** `devtools: { enabled, defaultOpen, position }` — in browser runtimes the floating panel defaults **on** unless disabled; set **`devtools.enabled: false`** to hide it in production UIs.

---

## API reference (short)

### `createSpectyra(config?)`

Common fields: `runMode`, `licenseKey`, `spectyraCloudApiKey`, `spectyraApiBaseUrl`, `telemetry`, `promptSnapshots`, `productSurface`, `environment`, `overlay`, `debug`, `logLevel`, `devtools`, `entitlements`, `workflowPolicy`, hooks (see [Observability](#observability-hooks--getters)).

### `spectyra.complete(input, adapter)`

- `input.provider`, `input.client`, `input.model`, `input.messages` — required.  
- `input.runContext` — optional: `project`, `environment`, `sessionId`, `runId`, etc.

**Returns** `SpectyraCompleteResult`: `providerResult`, `report` (`SavingsReport`), optional `promptComparison`, `flowSignals`, license fields when applicable.

### `spectyra.agentOptions(ctx, prompt)` / `agentOptionsRemote` (deprecated)

Prefer **`complete()`** for new code.

---

## Savings report

`SavingsReport` is defined in `@spectyra/core-types` and re-exported from this package. Highlights: `inputTokensBefore` / `inputTokensAfter`, `outputTokens`, `estimatedCostBefore` / `estimatedCostAfter`, `estimatedSavings`, `estimatedSavingsPct`, `transformsApplied`, `runId`, `createdAt`, optional analytics hints and `notes`.

---

## Advanced topics

**Local Companion / OpenClaw** — the **`@spectyra/local-companion`** package is the OpenClaw HTTP + local UI path. Embedding in **your** app only requires **`@spectyra/sdk`**.

**Moat analytics, workflow policy, model aliases, `startSpectyraSession`** — see package exports and companion parity docs in the repo.

**`SpectyraClient` (legacy)** — deprecated gateway client; prefer **`createSpectyra().complete()`**.

---

## Release verification

Before publishing, follow **`RELEASE.md`** in this package (build → `npm pack` → smoke imports).

---

## License

MIT
