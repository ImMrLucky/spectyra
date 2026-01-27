# How Spectyra Forwards Requests to OpenAI, Claude, etc.

## 🔄 Request Flow Overview

When a customer app sends a message through Spectyra:

1. **Request arrives** at `/v1/chat` endpoint
2. **Provider key extracted** (BYOK from `X-PROVIDER-KEY` header or default from env)
3. **Provider instance created** (OpenAI, Anthropic, Gemini, or Grok)
4. **Optimization pipeline runs** (unitize, embed, spectral analysis, policy transforms)
5. **Provider's `chat()` method called** - **This is where the actual HTTP request to OpenAI/Claude happens**
6. **Response returned** to customer app

## 📁 Key Files

### 1. Entry Point: `/v1/chat` Route
**File:** `apps/api/src/routes/chat.ts`

This is where requests first arrive:

```typescript
// Line 54-71: Extract provider key and create provider
const providerKeyOverride = req.context?.providerKeyOverride; // From X-PROVIDER-KEY header
let llmProvider;

if (providerKeyOverride) {
  // BYOK: Create provider with user's API key
  llmProvider = createProviderWithKey(provider, providerKeyOverride);
} else {
  // Use default provider from env vars
  llmProvider = providerRegistry.get(provider);
}

// Line 80: Wrap provider in optimizer adapter
const optimizerProvider = createOptimizerProvider(llmProvider);

// Line 183: Run optimizer (which calls provider.chat())
const result = await runOptimizedOrBaseline({
  mode,
  path,
  model,
  provider: optimizerProvider, // ← This is the wrapped provider
  embedder,
  messages: chatMessages,
}, cfg);
```

### 2. Provider Factory (BYOK Support)
**File:** `apps/api/src/services/llm/providerFactory.ts`

Creates provider instances with custom API keys:

```typescript
// Line 22-45: Factory function
export function createProviderWithKey(
  providerName: string,
  apiKey: string
): ChatProvider | undefined {
  switch (providerName.toLowerCase()) {
    case "openai":
      return new OpenAIProviderWithKey(apiKey); // ← Creates OpenAI client with key
    case "anthropic":
      return new AnthropicProviderWithKey(apiKey); // ← Creates Anthropic client with key
    // ... gemini, grok
  }
}
```

### 3. Provider Implementations (Actual HTTP Calls)

#### OpenAI Provider
**File:** `apps/api/src/services/llm/providerFactory.ts` (lines 52-90)

```typescript
class OpenAIProviderWithKey implements ChatProvider {
  private client: OpenAI;
  
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey }); // ← OpenAI SDK client
  }
  
  async chat(messages: Message[], model: string, maxOutputTokens?: number) {
    // THIS IS WHERE THE ACTUAL HTTP REQUEST TO OPENAI HAPPENS
    const response = await this.client.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      ...(maxOutputTokens ? { max_tokens: maxOutputTokens } : {}),
    });
    
    return {
      text: response.choices[0]?.message?.content || "",
      usage: { /* token usage */ }
    };
  }
}
```

#### Anthropic Provider
**File:** `apps/api/src/services/llm/providerFactory.ts` (lines 93-135)

```typescript
class AnthropicProviderWithKey implements ChatProvider {
  private client: Anthropic;
  
  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey }); // ← Anthropic SDK client
  }
  
  async chat(messages: Message[], model: string, maxOutputTokens?: number) {
    // THIS IS WHERE THE ACTUAL HTTP REQUEST TO ANTHROPIC HAPPENS
    const response = await this.client.messages.create({
      model,
      max_tokens: maxOutputTokens || 4096,
      system: systemMessage?.content,
      messages: conversationMessages.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
    });
    
    return {
      text: response.content[0]?.type === "text" ? response.content[0].text : "",
      usage: { /* token usage */ }
    };
  }
}
```

### 4. Provider Adapter (Optimizer Wrapper)
**File:** `apps/api/src/services/optimizer/providerAdapter.ts`

Wraps the LLM provider to match optimizer's interface:

```typescript
export function createOptimizerProvider(llmProvider: LLMChatProvider): OptimizerChatProvider {
  return {
    id: llmProvider.name,
    chat: async (args) => {
      // Convert format and call the actual provider
      const result = await llmProvider.chat(messages, args.model, args.maxOutputTokens);
      // ← This calls OpenAI/Anthropic/etc.
      return { text: result.text, usage: result.usage };
    },
  };
}
```

### 5. Optimizer (Calls Provider)
**File:** `apps/api/src/services/optimizer/optimizer.ts`

After optimization, calls the provider:

```typescript
// Line 98-102: Helper function that calls provider
async function callWithPolicy(...) {
  return provider.chat({
    model,
    messages: messagesFinal, // ← Optimized messages
    maxOutputTokens
  });
  // ↑ This eventually calls OpenAI/Anthropic HTTP API
}

// Line 113: Baseline mode (no optimization)
if (mode === "baseline") {
  const out = await provider.chat({ model, messages });
  // ↑ Direct call to provider
}

// Line 231: Optimized mode
const out = await callWithPolicy(path, provider, model, messagesFinal, localCfg, false);
// ↑ Calls provider with optimized messages
```

## 🔍 Complete Request Flow

```
Customer App
    ↓
POST /v1/chat
    ↓
apps/api/src/routes/chat.ts
    ↓
Extract X-PROVIDER-KEY header (BYOK)
    ↓
createProviderWithKey(provider, apiKey)
    ↓
apps/api/src/services/llm/providerFactory.ts
    ↓
new OpenAIProviderWithKey(apiKey)
    OR
new AnthropicProviderWithKey(apiKey)
    ↓
createOptimizerProvider(llmProvider)
    ↓
apps/api/src/services/optimizer/providerAdapter.ts
    ↓
runOptimizedOrBaseline({ provider: optimizerProvider, ... })
    ↓
apps/api/src/services/optimizer/optimizer.ts
    ↓
[Optimization pipeline: unitize, embed, spectral, policy transforms]
    ↓
provider.chat({ model, messages: optimizedMessages })
    ↓
apps/api/src/services/optimizer/providerAdapter.ts
    ↓
llmProvider.chat(messages, model, maxOutputTokens)
    ↓
apps/api/src/services/llm/providerFactory.ts
    ↓
this.client.chat.completions.create(...)  [OpenAI]
    OR
this.client.messages.create(...)  [Anthropic]
    ↓
HTTP Request to:
- https://api.openai.com/v1/chat/completions
- https://api.anthropic.com/v1/messages
    ↓
Response from OpenAI/Anthropic
    ↓
Return to customer app
```

## 🎯 Key Points

### 1. Provider Key Source (BYOK)

The provider API key comes from:
- **`X-PROVIDER-KEY` header** (BYOK - Bring Your Own Key) - **Preferred**
- **Environment variables** (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) - Fallback

**Location:** `apps/api/src/routes/chat.ts` line 56

### 2. Provider Creation

Providers are created with the customer's API key:
- **BYOK:** `createProviderWithKey(provider, customerApiKey)` 
- **Default:** `providerRegistry.get(provider)` (uses env vars)

**Location:** `apps/api/src/services/llm/providerFactory.ts`

### 3. Actual HTTP Calls

The actual HTTP requests to OpenAI/Anthropic happen in:
- **OpenAI:** `this.client.chat.completions.create()` → `https://api.openai.com/v1/chat/completions`
- **Anthropic:** `this.client.messages.create()` → `https://api.anthropic.com/v1/messages`
- **Gemini:** `genModel.startChat().sendMessage()` → Google API
- **Grok:** `fetch("https://api.x.ai/v1/chat/completions")` → Grok API

**Location:** `apps/api/src/services/llm/providerFactory.ts` (lines 72, 116, 169, 198)

### 4. Optimization Happens Before Provider Call

The optimization pipeline runs **before** calling the provider:
1. Unitize messages
2. Generate embeddings
3. Build spectral graph
4. Apply policy transforms (context compaction, delta prompting, code slicing)
5. **Then** call provider with optimized messages

**Location:** `apps/api/src/services/optimizer/optimizer.ts` (lines 124-231)

## 📊 Example: OpenAI Request

```typescript
// 1. Customer sends request with X-PROVIDER-KEY header
POST /v1/chat
Headers: {
  "X-SPECTYRA-API-KEY": "sk_spectyra_...",
  "X-PROVIDER-KEY": "sk-..." // Customer's OpenAI key
}
Body: {
  provider: "openai",
  model: "gpt-4o-mini",
  messages: [...]
}

// 2. Spectyra creates OpenAI provider with customer's key
const provider = new OpenAIProviderWithKey("sk-...");

// 3. Optimization runs (unitize, embed, spectral, transforms)

// 4. Provider.chat() is called with optimized messages
const response = await provider.client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: optimizedMessages, // ← Optimized version
  max_tokens: 450
});

// 5. This makes HTTP request to:
// POST https://api.openai.com/v1/chat/completions
// Headers: { "Authorization": "Bearer sk-..." }
// Body: { model, messages, max_tokens }

// 6. OpenAI responds with completion

// 7. Spectyra returns response to customer
```

## 🔐 Security: Provider Keys Never Stored

- ✅ Provider keys are **ephemeral** (only in memory during request)
- ✅ Keys come from `X-PROVIDER-KEY` header (BYOK)
- ✅ Keys are **never logged** (redacted in logs)
- ✅ Keys are **never stored** in database
- ✅ Only fingerprint (safe hash) stored for audit

**Location:** `apps/api/src/middleware/auth.ts` (lines 184-213)

## 📚 Related Files

- **Entry:** `apps/api/src/routes/chat.ts`
- **Provider Factory:** `apps/api/src/services/llm/providerFactory.ts`
- **Provider Registry:** `apps/api/src/services/llm/providerRegistry.ts`
- **OpenAI Default:** `apps/api/src/services/llm/openai.ts`
- **Anthropic Default:** `apps/api/src/services/llm/anthropic.ts`
- **Optimizer Adapter:** `apps/api/src/services/optimizer/providerAdapter.ts`
- **Optimizer:** `apps/api/src/services/optimizer/optimizer.ts`

## 🎯 Summary

**The actual HTTP requests to OpenAI/Claude/etc. happen in:**
- `apps/api/src/services/llm/providerFactory.ts`
- Inside the `chat()` method of `OpenAIProviderWithKey`, `AnthropicProviderWithKey`, etc.
- These use the official SDKs (`openai`, `@anthropic-ai/sdk`) which make HTTP requests
- The customer's API key (from `X-PROVIDER-KEY` header) is used for authentication
- The optimized messages are sent to the provider API
- The response is returned to the customer app
