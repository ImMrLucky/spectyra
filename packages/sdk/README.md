# Spectyra SDK (`@spectyra/sdk`)

SDK-first agent runtime control for **routing**, **budgets**, **tool gating**, and **telemetry**.

This package is designed for **agent frameworks** (including Claude Agent SDK patterns) and for teams who want:

- **Better first actions** (e.g. “run tests first” becomes a strict tool action)
- **Less looping / file thrashing** in coding flows
- **Budget + tool policy control** without rewriting your agent
- Optional **API control plane** mode for centralized governance and telemetry

---

## Requirements

- **Node.js 18+**
- ESM environment (this package ships as ESM)

---

## Installation

```bash
npm install @spectyra/sdk
# or
pnpm add @spectyra/sdk
# or
yarn add @spectyra/sdk
```

---

## What Spectyra does (and does not do)

- **Does**: return an options object (model/budget/tools/permissions) and/or call Spectyra API to get them
- **Does**: provide a “behavior kernel” (operating rules) that keeps agents grounded (especially for coding)
- **Does not**: replace your LLM provider call by default
- **Does not**: require a proxy (proxy is a separate product for IDE-level routing)

If you’re using an agent framework, the integration is:

> **Where you would pass agent options, get them from Spectyra instead.**

---

## Quick Start (Local Mode)

Local mode is synchronous and requires **no API**.

```ts
import { createSpectyra } from "@spectyra/sdk";

const spectyra = createSpectyra({ mode: "local" });

const ctx = {
  runId: crypto.randomUUID(),
  budgetUsd: 2.5,
  tags: { project: "my-app" },
};

const prompt = "Fix the failing tests. Run tests first and paste output.";
const options = spectyra.agentOptions(ctx, prompt);

// Pass options into your agent framework
// agent.query({ prompt, options })
console.log(options);
```

---

## Quick Start (API Mode / Control Plane)

API mode fetches options from your Spectyra deployment and can stream events for telemetry.

```ts
import { createSpectyra } from "@spectyra/sdk";

const spectyra = createSpectyra({
  mode: "api",
  endpoint: process.env.SPECTYRA_ENDPOINT || "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY,
});

const ctx = { runId: crypto.randomUUID(), budgetUsd: 5.0 };

const promptMeta = {
  promptChars: 10000,
  path: "code",
  repoId: "my-repo",
  language: "typescript",
};

const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
// response.options is safe to pass into your agent
```

**Required env vars (API mode):**

- `SPECTYRA_API_KEY`
- `SPECTYRA_ENDPOINT` (optional; defaults to Spectyra hosted URL)

---

## “Run tests first” behavior (coding flows)

Spectyra’s coding flow state compiler is designed to turn “run tests/lint” into an unambiguous first action.

If the user asks:

> “Run the full test suite and paste output”

Spectyra’s generated operating rules require:

- **Call the tool immediately** (`run_terminal_cmd`)
- **Do NOT read_file first**
- **Do not narrate** (“Checking …” autopilot stops)

This behavior is enforced in the SCC compiler and is measurable in Spectyra Studio / governance metrics.

---

## Claude Agent SDK integration pattern (options injection)

Spectyra does not replace the agent; it produces options that guide it.

```ts
import { createSpectyra } from "@spectyra/sdk";
// import { Agent } from "@anthropic-ai/sdk/agent";

const spectyra = createSpectyra({ mode: "local" });

const ctx = { runId: crypto.randomUUID(), budgetUsd: 2.5 };
const prompt = "Fix the build; run tests first.";

const options = spectyra.agentOptions(ctx, prompt);

// const agent = new Agent({ apiKey: process.env.ANTHROPIC_API_KEY, ...options });
// const result = await agent.query({ prompt });
```

---

## API Reference (high-signal)

### `createSpectyra(config?: SpectyraConfig)`

Creates a Spectyra instance.

- `mode?: "local" | "api"` (default `"local"`)
- `endpoint?: string` (required for `"api"`)
- `apiKey?: string` (required for `"api"`)
- `defaults?: { budgetUsd?: number; models?: { small?: string; medium?: string; large?: string } }`

### `agentOptions(ctx: SpectyraCtx, prompt: string | PromptMeta): ClaudeAgentOptions`

Returns agent options synchronously (local heuristics).

### `agentOptionsRemote(ctx: SpectyraCtx, promptMeta: PromptMeta): Promise<AgentOptionsResponse>`

Fetches agent options from Spectyra API.

### `sendAgentEvent(ctx: SpectyraCtx, event: any): Promise<void>`

Best-effort telemetry event.

### `observeAgentStream(ctx: SpectyraCtx, stream: AsyncIterable<any>): Promise<void>`

Observes an agent stream and forwards events automatically.

---

## Agent options shape (what you pass to the agent)

```ts
interface ClaudeAgentOptions {
  model?: string;
  maxBudgetUsd?: number;
  allowedTools?: string[];
  permissionMode?: "acceptEdits";
  canUseTool?: (tool: string, input: any) => boolean;
}
```

---

## Local mode decision logic (defaults)

Local mode uses conservative heuristics:

- **Prompt length < 6k chars** → `claude-3-5-haiku-latest`
- **Prompt length < 20k chars** → `claude-3-5-sonnet-latest`
- **Prompt length ≥ 20k chars** → `claude-3-7-sonnet-latest`

Defaults:

- Budget: `$2.5`
- Tools: `["Read", "Edit", "Bash", "Glob"]`
- Permissions: `"acceptEdits"`

---

## Tool gating (local)

The default `canUseTool` gate:

- Allows: Read/Edit/Glob and safe Bash
- Blocks obvious exfiltration/networking commands (e.g. `curl`, `wget`, `ssh`, `scp`, `nc`, `telnet`)

You can override tool gating by replacing `canUseTool` in your agent options.

---

## Legacy: Remote chat optimization (`SpectyraClient`)

`SpectyraClient` exists for legacy chat-style integration. It is **deprecated** for agentic usage; prefer `createSpectyra()`.

```ts
import { SpectyraClient } from "@spectyra/sdk";

const client = new SpectyraClient({
  apiUrl: "https://spectyra.up.railway.app/v1",
  spectyraKey: process.env.SPECTYRA_API_KEY,
  provider: "openai",
  providerKey: process.env.OPENAI_API_KEY,
});

const response = await client.chat({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
  path: "talk",
  optimization_level: 3,
});
```

---

## Testing your install (what we recommend)

Local mode can be validated without any API keys:

```bash
node -e "import('@spectyra/sdk').then(m=>console.log('✅ exports:',Object.keys(m)))"
```

For deeper tests, see `TESTING.md` in the repo.

---

## Troubleshooting

### NPM page says “No README”

NPM displays the README from the published tarball. If your currently published version shows no README, publish a new version where `README.md` is included at the package root.

You can verify packaging locally:

```bash
cd packages/sdk
npm pack --dry-run
```

Look for `README.md` in the tarball contents.

### API mode returns 403 “SDK access is disabled”

Your org’s SDK access is controlled by admin settings. Enable SDK access for the org in Spectyra Admin.

---

## BYOK (Bring Your Own Key)

- Provider keys are never stored server-side
- Used only for the duration of a request
- You control provider billing

---

## License

MIT
