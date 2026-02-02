# Spectyra SDK

**SDK-first agent runtime control: routing, budgets, tool gating, telemetry**

Spectyra SDK provides agent runtime control for Claude Agent SDK and other agent frameworks. Control model selection, budgets, tool permissions, and telemetry—all without requiring a proxy.

## Installation

```bash
npm install @spectyra/sdk
# or
pnpm add @spectyra/sdk
# or
yarn add @spectyra/sdk
```

## Two Integration Styles

Spectyra does **not** replace your LLM call when using Claude Agent SDK. It supplies **options** (model, tools, budget) that you pass into the agent. Claude Agent SDK does the agentic work and LLM calls. The integration is: **where you'd pass options to the agent, get them from Spectyra instead.**

### A) Local SDK Mode (Default)

**No proxy required.** SDK makes local decisions about agent options.

```typescript
import { createSpectyra } from '@spectyra/sdk';

// Local mode - works offline, no API calls
const spectyra = createSpectyra({ mode: "local" });

// One line: get options from Spectyra instead of hardcoding. Claude Agent SDK does the rest.
const options = spectyra.agentOptions(ctx, prompt);
const result = await agent.query({ prompt, options });
```

### B) API Control Plane Mode (Enterprise)

SDK calls Spectyra API to fetch agent options and stream events for telemetry.

```typescript
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({
  mode: "api",
  endpoint: "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY,
});

// Fetch options from remote API
const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
const result = await agent.query({ prompt, options: response.options });

// Stream events for telemetry
for await (const event of agentStream) {
  await spectyra.sendAgentEvent(ctx, event);
}
```

## Quick Start: Local Mode

```typescript
import { createSpectyra } from '@spectyra/sdk';
import { Agent } from '@anthropic-ai/sdk/agent';

// Create Spectyra instance (local mode - default)
const spectyra = createSpectyra({ mode: "local" });

// Create context for this agent run
const ctx = {
  runId: crypto.randomUUID(),
  budgetUsd: 2.5,
  tags: { project: "my-app" },
};

// Get agent options (synchronous, local decision)
const prompt = "Fix the bug in src/utils.ts";
const options = spectyra.agentOptions(ctx, prompt);

// Use with Claude Agent SDK
const agent = new Agent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...options, // Model, budget, tools, permissions
});

const result = await agent.query({ prompt });
```

## Quick Start: API Mode

```typescript
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({
  mode: "api",
  endpoint: "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY,
});

const ctx = {
  runId: crypto.randomUUID(),
  budgetUsd: 5.0,
};

// Fetch options from remote API
const promptMeta = {
  promptChars: prompt.length,
  path: "code",
  repoId: "my-repo",
  language: "typescript",
};

const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
// response.run_id is set automatically

// Use options with agent
const agent = new Agent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...response.options,
});

// Stream events for telemetry
const stream = agent.queryStream({ prompt });
await spectyra.observeAgentStream(ctx, stream);
```

## API Reference

### `createSpectyra(config?: SpectyraConfig)`

Create a Spectyra SDK instance.

**Config:**
- `mode?: "local" | "api"` - Default: `"local"`
- `endpoint?: string` - Required for API mode
- `apiKey?: string` - Required for API mode
- `defaults?: { budgetUsd?: number; models?: { small?, medium?, large? } }`

**Returns:** `SpectyraInstance`

### `agentOptions(ctx: SpectyraCtx, prompt: string | PromptMeta): ClaudeAgentOptions`

Get agent options locally (synchronous, offline).

**Context:**
- `runId?: string` - Run identifier
- `budgetUsd?: number` - Budget for this run
- `tags?: Record<string, string>` - Tags for analytics

**Returns:** Claude Agent SDK-compatible options

### `agentOptionsRemote(ctx: SpectyraCtx, promptMeta: PromptMeta): Promise<AgentOptionsResponse>`

Fetch agent options from remote API (asynchronous).

**PromptMeta:**
- `promptChars: number` - Prompt character count
- `path?: "code" | "talk"` - Path type
- `repoId?: string` - Repository identifier
- `language?: string` - Programming language
- `filesChanged?: number` - Number of files changed

**Returns:** Options with `run_id` and `reasons`

### `sendAgentEvent(ctx: SpectyraCtx, event: any): Promise<void>`

Send agent event for telemetry (best-effort, non-blocking).

### `observeAgentStream(ctx: SpectyraCtx, stream: AsyncIterable<any>): Promise<void>`

Observe agent stream and forward events automatically.

## Agent Options

The SDK returns Claude Agent SDK-compatible options:

```typescript
interface ClaudeAgentOptions {
  model?: string;                    // e.g., "claude-3-5-sonnet-latest"
  maxBudgetUsd?: number;             // Budget limit
  allowedTools?: string[];           // e.g., ["Read", "Edit", "Bash"]
  permissionMode?: "acceptEdits";    // Permission mode
  canUseTool?: (tool, input) => boolean; // Tool gate function
}
```

## Local Decision Logic

In local mode, the SDK uses simple heuristics:

- **Prompt length < 6k chars** → Small tier → `claude-3-5-haiku-latest`
- **Prompt length < 20k chars** → Medium tier → `claude-3-5-sonnet-latest`
- **Prompt length ≥ 20k chars** → Large tier → `claude-3-7-sonnet-latest`

Default budget: $2.5 per run  
Default tools: `["Read", "Edit", "Bash", "Glob"]`  
Default permissions: `"acceptEdits"`

## Tool Gating

The SDK includes a default `canUseTool` gate that:
- ✅ Allows: Read, Edit, Bash (safe commands), Glob
- ❌ Denies: Bash commands containing `curl`, `wget`, `ssh`, `scp`, `nc`, `telnet`

You can override this by providing your own `canUseTool` function in the options.

## Remote Chat Optimization (Optional)

For chat optimization (not agentic), use the legacy client:

```typescript
import { SpectyraClient } from '@spectyra/sdk';

const client = new SpectyraClient({
  apiUrl: 'https://spectyra.up.railway.app/v1',
  spectyraKey: process.env.SPECTYRA_API_KEY,
  provider: 'openai',
  providerKey: process.env.OPENAI_API_KEY, // BYOK
});

const response = await client.chat({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello' }],
  path: 'talk',
  optimization_level: 3,
});
```

**Note:** `SpectyraClient` is deprecated. For agentic use cases, use `createSpectyra()`.

## Examples

See `examples/` directory:
- `claude-agent-local.ts` - Local mode with Claude Agent SDK
- `claude-agent-remote.ts` - API mode with telemetry
- `chat-remote.ts` - Chat optimization (legacy)

## BYOK (Bring Your Own Key)

- Provider API keys are **never stored** server-side
- Keys are only used for the duration of the request
- You maintain full control over provider billing
- Agent options/events endpoints don't require provider keys

## License

MIT
