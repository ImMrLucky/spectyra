# Implementation Notes

## Current Status

The agent wrappers are implemented with the following capabilities:

### ✅ Implemented

1. **Claude Wrapper** (`wrapClaudeRequest`)
   - Converts Claude SDK messages to/from internal format
   - Applies CodeMap if repoContext provided
   - Calls Spectyra API for full optimization (when configured)
   - Returns optimized messages and optimization report

2. **OpenAI Wrapper** (`wrapOpenAIInput`)
   - Converts OpenAI messages to/from internal format
   - Same optimization capabilities as Claude wrapper
   - Preserves tool call structures

3. **Generic Wrapper** (`wrapGenericAgentLoop`)
   - Framework-agnostic adapter pattern
   - Works with any agent framework
   - Requires implementing `toMessages` and `fromMessages` adapters

4. **Repo Context Capture** (`captureRepoContext`)
   - Reads files from filesystem
   - Respects include/exclude globs
   - Prioritizes changed files and entrypoints
   - Caps total bytes

### ⚠️ Limitations

1. **API Endpoint Limitation**
   - The `/v1/chat` endpoint in dry-run mode returns estimates but not optimized messages
   - Current implementation applies CodeMap locally and calls API for metrics
   - **TODO**: Create `/v1/optimize` endpoint that returns optimized messages without LLM call

2. **Local-Only Mode**
   - Without API endpoint/key, only CodeMap is applied
   - RefPack and PhraseBook require API call
   - Semantic cache requires API

## Recommended Next Steps

### 1. Create `/v1/optimize` Endpoint

Add a new endpoint specifically for agent wrappers:

```typescript
// apps/api/src/routes/optimize.ts
POST /v1/optimize
{
  messages: Message[],
  repoContext?: RepoContext,
  mode: "auto" | "code" | "chat",
  runId?: string,
  turnIndex?: number
}

Response:
{
  messages: Message[], // Optimized messages
  optimization_report: OptimizationReportPublic,
  cache_key?: string,
  cache_hit?: boolean
}
```

This endpoint would:
- Run optimizer pipeline (CodeMap, RefPack, PhraseBook)
- Return optimized messages
- NOT make LLM provider call
- Return optimization metrics

### 2. Update `optimizeAgentMessages` to Use New Endpoint

Once `/v1/optimize` exists, update `optimizeAgentMessages` to call it instead of `/v1/chat` with dry-run.

## Usage Patterns

### Pattern 1: With API (Full Optimization)

```typescript
const { messages } = await wrapClaudeRequest({
  messages: claudeMessages,
  repoContext: { files: [...] },
  config: {
    apiEndpoint: "https://spectyra.up.railway.app/v1",
    apiKey: process.env.SPECTYRA_API_KEY,
  },
});
// Messages are fully optimized (CodeMap + RefPack + PhraseBook)
```

### Pattern 2: Without API (CodeMap Only)

```typescript
const { messages } = await wrapClaudeRequest({
  messages: claudeMessages,
  repoContext: { files: [...] },
  // No config = local CodeMap only
});
// Messages have CodeMap injected, but no RefPack/PhraseBook
```

## Testing

To test the wrappers:

1. **Local CodeMap Test**:
   ```bash
   # No API keys needed
   npx tsx examples/claude-sdk-coding-agent.ts
   ```

2. **Full Optimization Test**:
   ```bash
   # Requires SPECTYRA_API_KEY
   export SPECTYRA_API_KEY=your-key
   export SPECTYRA_API_ENDPOINT=https://spectyra.up.railway.app/v1
   npx tsx examples/claude-sdk-coding-agent.ts
   ```

## Integration with Existing SDK

The `@spectyra/agents` package is complementary to `@spectyra/sdk`:
- **SDK**: For agent options and event telemetry
- **Agents**: For message optimization before LLM calls

They can be used together:
```typescript
import { createSpectyra } from "@spectyra/sdk";
import { wrapClaudeRequest } from "@spectyra/agents";

const spectyra = createSpectyra({ mode: "api", ... });
const options = await spectyra.agentOptionsRemote(ctx, promptMeta);

// Optimize messages before calling Claude
const { messages } = await wrapClaudeRequest({
  messages: claudeMessages,
  repoContext: { files: [...] },
  config: { apiEndpoint: "...", apiKey: "..." },
});

// Use optimized messages
const response = await claude.messages.create({ messages, ...options });
```
