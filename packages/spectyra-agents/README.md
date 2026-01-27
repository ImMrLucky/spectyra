# @spectyra/agents

Coding agent wrappers for Spectyra Core Moat v1 optimizations.

Drop-in optimizers that sit inside agent loops to compress:
- **Repo context** (CodeMap with SNIPPETS)
- **Tool outputs** (RefPack)
- **Repeated instructions** (PhraseBook)
- **Retries + recursion** (semantic cache)

## Installation

```bash
npm install @spectyra/agents
```

## Quick Start

### Claude SDK Wrapper

```typescript
import { wrapClaudeRequest } from "@spectyra/agents";
import Anthropic from "@anthropic-ai/sdk";

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Wrap your messages before calling Claude
const { messages, optimizationReport } = await wrapClaudeRequest({
  messages: claudeMessages,
  repoContext: { files: [...] },
  mode: "code",
  config: {
    apiEndpoint: "https://spectyra.up.railway.app/v1",
    apiKey: process.env.SPECTYRA_API_KEY,
  },
});

// Use optimized messages
const response = await claude.messages.create({
  model: "claude-3-5-sonnet",
  messages: messages,
});

console.log(`Optimizations: ${optimizationReport.layers}`);
console.log(`Tokens saved: ${optimizationReport.tokens.saved}`);
```

### OpenAI Wrapper

```typescript
import { wrapOpenAIInput } from "@spectyra/agents";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Wrap your messages before calling OpenAI
const { messages, optimizationReport } = await wrapOpenAIInput({
  messages: openaiMessages,
  repoContext: { files: [...] },
  mode: "code",
  config: {
    apiEndpoint: "https://spectyra.up.railway.app/v1",
    apiKey: process.env.SPECTYRA_API_KEY,
  },
});

// Use optimized messages
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: messages,
});
```

### Generic Wrapper (Any Framework)

```typescript
import { wrapGenericAgentLoop } from "@spectyra/agents";

// Your original agent loop
async function myAgentLoop(request: MyRequest): Promise<MyResponse> {
  return await myProvider.chat(request);
}

// Wrap with Spectyra optimization
const optimizedLoop = await wrapGenericAgentLoop({
  toMessages: (req) => req.messages,
  fromMessages: (msgs, orig) => ({ ...orig, messages: msgs }),
  callProvider: myAgentLoop,
  getAssistantText: (res) => res.text,
  repoContext: { files: [...] },
  mode: "code",
  spectyraConfig: {
    apiEndpoint: "https://spectyra.up.railway.app/v1",
    apiKey: process.env.SPECTYRA_API_KEY,
  },
});

// Use wrapped function
const response = await optimizedLoop(myRequest);
```

### Repo Context Capture (VM-based Agents)

```typescript
import { captureRepoContext } from "@spectyra/agents";

// Capture repo context for CodeMap
const repoContext = await captureRepoContext({
  rootPath: "/path/to/repo",
  includeGlobs: ["**/*.ts", "**/*.tsx"],
  excludeGlobs: ["**/node_modules/**", "**/dist/**"],
  maxBytes: 100000, // 100KB
  entrypoints: ["src/index.ts"],
});

// Use in wrapper
const { messages } = await wrapClaudeRequest({
  messages: claudeMessages,
  repoContext,
  mode: "code",
});
```

## Features

- ✅ **CodeMap**: Compresses repo context with SNIPPETS payload (dereferenceable)
- ✅ **RefPack**: Compresses repeated tool outputs and history
- ✅ **PhraseBook**: Encodes repeated phrases
- ✅ **Semantic Cache**: Caches optimized responses
- ✅ **Code Fence Protection**: Never modifies code inside ``` fences
- ✅ **Framework Agnostic**: Works with any agent framework

## Examples

See `/examples` directory for complete working examples:
- `claude-sdk-coding-agent.ts` - Claude SDK integration
- `openai-codex-loop.ts` - OpenAI agent loop
- `generic-tool-loop.ts` - Framework-agnostic wrapper

## API Reference

### `wrapClaudeRequest(input)`

Wraps Claude SDK messages with Spectyra optimizations.

**Input:**
- `messages: ClaudeLikeMessage[]` - Claude SDK message format
- `repoContext?: RepoContext` - Optional repo context for CodeMap
- `mode?: "auto" | "code" | "chat"` - Optimization mode
- `runId?: string` - Run ID for tracking
- `config?: { apiEndpoint?: string; apiKey?: string }` - Spectyra API config

**Output:**
- `messages: ClaudeLikeMessage[]` - Optimized messages
- `optimizationReport: OptimizationReportPublic` - Optimization metrics
- `cacheKey?: string` - Cache key (if applicable)
- `cacheHit?: boolean` - Whether cache was hit

### `wrapOpenAIInput(input)`

Wraps OpenAI messages with Spectyra optimizations.

**Input:** Same as `wrapClaudeRequest` but with `OpenAILikeMessage[]`

**Output:** Same structure as `wrapClaudeRequest`

### `wrapGenericAgentLoop(config)`

Framework-agnostic wrapper that works with any agent framework.

**Config:**
- `toMessages(req)` - Convert framework request to messages
- `fromMessages(msgs, orig)` - Convert messages back to framework request
- `callProvider(req)` - The actual provider call
- `getAssistantText(res)` - Extract assistant text from response
- `getToolCalls?(res)` - Extract tool calls (optional)
- `repoContext?: RepoContext` - Repo context for CodeMap
- `mode?: "auto" | "code" | "chat"` - Optimization mode
- `spectyraConfig?: { apiEndpoint?: string; apiKey?: string }` - API config

**Returns:** `(req: TReq) => Promise<TRes>` - Wrapped function

### `captureRepoContext(options)`

Captures repository context from filesystem for CodeMap.

**Options:**
- `rootPath: string` - Root directory path
- `includeGlobs?: string[]` - File patterns to include (default: common code files)
- `excludeGlobs?: string[]` - File patterns to exclude (default: node_modules, dist, etc.)
- `maxBytes?: number` - Maximum total file size (default: 500KB)
- `changedFiles?: string[]` - Changed files to prioritize
- `entrypoints?: string[]` - Entry point files to always include
- `languageHint?: string` - Language hint for CodeMap

**Returns:** `Promise<RepoContext>`

## Environment Variables

```bash
# Spectyra API (optional - enables full optimization)
SPECTYRA_API_ENDPOINT=https://spectyra.up.railway.app/v1
SPECTYRA_API_KEY=your-api-key

# Without API, only CodeMap is applied (local optimization)
```

## How It Works

1. **Message Optimization**: Messages are sent to Spectyra API in dry-run mode
2. **Core Moat v1 Applied**: CodeMap, RefPack, PhraseBook optimizations applied
3. **Optimized Messages Returned**: You receive optimized messages without LLM call
4. **Use with Your Provider**: Pass optimized messages to your LLM provider (Claude/OpenAI/etc.)

## Code Fence Protection

All optimizations respect code fences (triple backticks):
- **RefPack**: Never replaces text inside ``` code blocks
- **PhraseBook**: Never encodes phrases inside ``` code blocks
- **CodeMap**: Only extracts code for SNIPPETS, never modifies inline code

This ensures code integrity in coding agent workflows.

## License

MIT
