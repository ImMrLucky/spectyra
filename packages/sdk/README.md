# Spectyra SDK

Real-time LLM optimization middleware that reduces token usage and cost by preventing semantic recomputation.

## Installation

```bash
npm install @spectyra/sdk
# or
pnpm add @spectyra/sdk
# or
yarn add @spectyra/sdk
```

## Quick Start

```typescript
import { SpectyraClient } from '@spectyra/sdk';

const client = new SpectyraClient({
  apiUrl: 'https://spectyra.up.railway.app/v1',
  spectyraKey: process.env.SPECTYRA_API_KEY,
  provider: 'openai',
  providerKey: process.env.OPENAI_API_KEY, // BYOK - Bring Your Own Key
});

const response = await client.chat({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Explain quantum computing' }
  ],
  path: 'talk',
  optimization_level: 3,
});

console.log(`Response: ${response.response_text}`);
console.log(`Saved ${response.savings?.pct_saved}% tokens`);
console.log(`Cost saved: $${response.savings?.cost_saved_usd}`);
```

## API Reference

### `SpectyraClient`

#### Constructor

```typescript
new SpectyraClient(config: SpectyraClientConfig)
```

**Config:**
- `apiUrl`: Spectyra API base URL
- `spectyraKey`: Your Spectyra API key
- `provider`: LLM provider (`"openai" | "anthropic" | "gemini" | "grok"`)
- `providerKey`: Your provider API key (BYOK - never stored server-side)

#### Methods

##### `chat(options: ChatOptions): Promise<ChatResponse>`

Send a chat request through Spectyra optimization.

**Options:**
- `model`: Model name (e.g., `"gpt-4o-mini"`)
- `messages`: Conversation messages
- `path`: `"talk"` for chat/Q&A, `"code"` for coding workflows
- `optimization_level`: 0-4 (default: 2)
  - 0 = Minimal
  - 1 = Conservative
  - 2 = Balanced
  - 3 = Aggressive
  - 4 = Maximum
- `conversation_id`: Optional conversation ID for state tracking
- `dry_run`: Estimate savings without making real LLM calls

**Returns:**
- `response_text`: Optimized response
- `usage`: Token usage
- `cost_usd`: Estimated cost
- `savings`: Savings metrics (tokens saved, %, cost saved, confidence band)
- `quality`: Quality check results

##### `estimateSavings(options): Promise<ChatResponse>`

Estimate savings without making real LLM calls (convenience method for `chat` with `dry_run: true`).

## BYOK (Bring Your Own Key)

Spectyra uses BYOK architecture:
- Your provider API keys are sent via `X-PROVIDER-KEY` header
- Keys are **never stored** server-side
- Keys are only used for the duration of the request
- You maintain full control over your provider billing

## Examples

### Basic Chat

```typescript
const response = await client.chat({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'What is React?' }
  ],
  path: 'talk',
  optimization_level: 2,
});
```

### Code Workflow

```typescript
const response = await client.chat({
  model: 'claude-3-5-sonnet-20241022',
  messages: [
    { role: 'user', content: 'Fix this bug: ...' }
  ],
  path: 'code',
  optimization_level: 3,
});
```

### Estimate Savings (Dry Run)

```typescript
const estimate = await client.estimateSavings({
  model: 'gpt-4o-mini',
  messages: [...],
  path: 'talk',
  optimization_level: 3,
});

console.log(`Estimated savings: ${estimate.savings?.pct_saved}%`);
```

## License

MIT
