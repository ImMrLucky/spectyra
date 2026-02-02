# Claude Agent SDK Integration

## Two Ways to Integrate with Spectyra

| Integration | What Spectyra does | “One liner” |
|-------------|--------------------|-------------|
| **Gateway (`/v1/chat`)** | Optimizes prompts and calls the LLM for you. You send messages to Spectyra; Spectyra calls OpenAI/Claude. | Replace your LLM call with a call to Spectyra. |
| **SDK + Claude Agent** | Does **not** call the LLM. Supplies **options** (model, tools, budget) that you pass into the Claude Agent SDK. Claude SDK does the agentic work and LLM calls. | **Where you’d pass options to the agent, get them from Spectyra instead.** |

---

## SDK + Claude Agent: How It Works

- **Claude Agent SDK** does the agentic work: tool use, multi-step reasoning, and LLM calls. You keep using `query({ prompt, options })` (or equivalent).
- **Spectyra** only decides *which* options to use: model (haiku/sonnet/opus), budget, tool allowlist, permission mode, etc.

So the integration is: **replace where you’d build or hardcode agent options with a call to Spectyra.**

### Before (no Spectyra)

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

const prompt = "Fix failing tests.";
const options = {
  model: "claude-sonnet-4-20250514",
  maxBudgetUsd: 2.5,
  allowedTools: ["read_file", "run_terminal_cmd"],
};

for await (const evt of query({ prompt, options })) {
  // handle evt
}
```

### After (with Spectyra – one insertion point)

```typescript
import { createSpectyra } from "@spectyra/sdk";
import { query } from "@anthropic-ai/claude-agent-sdk";

const spectyra = createSpectyra({ mode: "local" });
const prompt = "Fix failing tests.";

// One line: get options from Spectyra instead of hardcoding
const options = spectyra.agentOptions({ orgId: "acme" }, prompt);

for await (const evt of query({ prompt, options })) {
  // Claude Agent SDK does the rest; optional: spectyra.observe(evt)
}
```

The “one liner” is: **`const options = spectyra.agentOptions(ctx, prompt);`** — use that instead of building `options` yourself. Everything else (prompt, `query`, streaming) stays the same; Claude Agent SDK still does the work and decisions.

---

## Local vs API Mode

- **Local:** `spectyra.agentOptions(ctx, prompt)` returns options from local policy (no network). Good for dev and simple deployments.
- **API:** `await spectyra.agentOptionsRemote(ctx, promptMeta)` fetches options from Spectyra API; use `sendAgentEvent` for telemetry. Good for centralized policy and audit.

Same idea in both: **options come from Spectyra; the agent call stays `query({ prompt, options })`.**
