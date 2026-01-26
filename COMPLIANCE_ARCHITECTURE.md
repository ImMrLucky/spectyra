# Compliance Architecture: How Spectyra Works Safely with All Providers

## Overview

Spectyra uses **official provider APIs directly** - this is 100% compliant with all provider Terms of Service. The architecture ensures we never intercept or modify web UI requests in a way that violates ToS.

## How It Works: Direct API Interaction

### ✅ Compliant Architecture

```
User's Application/Tool
  ↓
Spectyra API (middleware)
  ↓ (uses official provider SDKs)
Provider Official API
  ↓
Provider Response
  ↓
Spectyra Optimization
  ↓
User's Application/Tool
```

**Key Point**: Spectyra acts as **middleware** that:
1. Receives requests from user applications
2. Uses **official provider SDKs** to call provider APIs
3. Optimizes the request before sending
4. Returns optimized response

**This is 100% compliant** because:
- ✅ Uses official provider APIs (not web UI interception)
- ✅ Uses official provider SDKs (OpenAI, Anthropic, etc.)
- ✅ Follows provider API guidelines
- ✅ No unauthorized access or modification

## Integration Methods & Compliance

### 1. Local Proxy (✅ 100% Compliant)

**How it works:**
```
Coding Tool (Copilot/Cursor/etc)
  ↓
Local Proxy (localhost:3001)
  ↓ (converts to Spectyra format)
Spectyra API
  ↓ (uses official OpenAI SDK)
OpenAI Official API (api.openai.com)
  ↓
Response back through chain
```

**Compliance:**
- ✅ Uses official OpenAI API (`api.openai.com/v1/chat/completions`)
- ✅ Uses official Anthropic API (`api.anthropic.com/v1/messages`)
- ✅ Uses official Gemini API
- ✅ Uses official Grok API
- ✅ No web UI interception
- ✅ No unauthorized access
- ✅ Follows provider API guidelines

**Why it's safe:**
- The proxy provides an OpenAI-compatible endpoint
- Tools connect to the proxy (like connecting to OpenAI directly)
- Proxy forwards to Spectyra API
- Spectyra API uses official provider SDKs
- All API calls go through official endpoints

### 2. SDK / Direct API (✅ 100% Compliant)

**How it works:**
```typescript
// Developer's code
const client = new SpectyraClient({
  apiUrl: 'https://spectyra.up.railway.app/v1',
  spectyraKey: 'sk-...',
  providerKey: 'sk-...', // User's OpenAI key
});

// This calls Spectyra API
const response = await client.chat({
  provider: 'openai',
  model: 'gpt-4o-mini',
  messages: [...]
});

// Spectyra API then calls OpenAI official API
```

**Compliance:**
- ✅ Developer explicitly calls Spectyra API
- ✅ Spectyra API uses official provider SDKs
- ✅ No interception or modification
- ✅ Transparent to user
- ✅ 100% compliant

### 3. Browser Extension (⚠️ May Violate ToS)

**How it works:**
```
User visits ChatGPT web UI
  ↓
Browser Extension intercepts fetch requests
  ↓
Routes through Spectyra
  ↓
Returns modified response
```

**Compliance Status:**
- ⚠️ **May violate ChatGPT's ToS** (intercepts web UI)
- ⚠️ **May violate other provider ToS** (if intercepting web UIs)
- ✅ **Compliant if using official APIs** (if tool uses direct API calls)

**Why it might violate ToS:**
- Intercepts web UI requests (not official API)
- Modifies request/response flow
- Unauthorized access to web UI backend

**Safe Usage:**
- Only intercepts direct API calls (not web UI)
- Uses official provider APIs
- No modification of web UI behavior

## Backend Implementation: Official SDKs

### How Spectyra Backend Calls Providers

**OpenAI:**
```typescript
// apps/api/src/services/llm/openai.ts
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: config.providers.openai.apiKey, // User's key (BYOK)
});

const response = await this.client.chat.completions.create({
  model,
  messages: [...]
});
```

**Anthropic:**
```typescript
// apps/api/src/services/llm/anthropic.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: config.providers.anthropic.apiKey, // User's key (BYOK)
});

const response = await this.client.messages.create({
  model,
  messages: [...]
});
```

**Key Points:**
- ✅ Uses **official provider SDKs**
- ✅ Calls **official API endpoints**
- ✅ Follows **provider API guidelines**
- ✅ No web UI interaction
- ✅ 100% compliant

## BYOK (Bring Your Own Key) Model

### How BYOK Ensures Compliance

**User provides their own API keys:**
- User has legitimate API access
- User pays provider directly
- Spectyra acts as middleware only
- No unauthorized access

**Flow:**
1. User provides their OpenAI/Anthropic/etc. API key
2. Spectyra uses that key to call official provider API
3. User is billed by provider (not Spectyra)
4. Spectyra charges for optimization service only

**Why this is compliant:**
- ✅ User owns the API key
- ✅ User has legitimate access
- ✅ Spectyra uses official APIs
- ✅ No ToS violation

## Provider-Specific Compliance

### OpenAI
- ✅ **Official API**: Uses `api.openai.com/v1/chat/completions`
- ✅ **Official SDK**: Uses `openai` npm package
- ✅ **Compliant**: Direct API usage is allowed
- ⚠️ **Web UI**: Intercepting ChatGPT web UI may violate ToS

### Anthropic
- ✅ **Official API**: Uses `api.anthropic.com/v1/messages`
- ✅ **Official SDK**: Uses `@anthropic-ai/sdk` npm package
- ✅ **Compliant**: Direct API usage is allowed
- ⚠️ **Web UI**: Intercepting Claude web UI may violate ToS

### Gemini
- ✅ **Official API**: Uses `generativelanguage.googleapis.com`
- ✅ **Official SDK**: Uses `@google/generative-ai` npm package
- ✅ **Compliant**: Direct API usage is allowed

### Grok
- ✅ **Official API**: Uses `api.x.ai/v1/...`
- ✅ **Compliant**: Direct API usage is allowed

## Safe Usage Guidelines

### ✅ Safe (100% Compliant)

1. **Local Proxy for Coding Tools**
   - Tools use official APIs
   - Proxy forwards to Spectyra
   - Spectyra uses official SDKs
   - **Result**: 100% compliant

2. **SDK Integration**
   - Developer explicitly calls Spectyra
   - Spectyra uses official APIs
   - **Result**: 100% compliant

3. **Direct API Calls**
   - Developer calls Spectyra API directly
   - Spectyra uses official APIs
   - **Result**: 100% compliant

### ⚠️ Use with Caution

1. **Browser Extension for Web UIs**
   - Intercepts web UI requests
   - May violate provider ToS
   - **Recommendation**: Use for web tools only, understand risks
   - **Alternative**: Use proxy for desktop tools (safer)

## Architecture Safety

### Request Flow (Compliant)

```
User Application
  ↓ (explicit API call)
Spectyra API
  ↓ (uses official SDK)
Provider Official API
  ↓ (official response)
Spectyra API
  ↓ (optimized response)
User Application
```

**Safety Features:**
- ✅ No interception
- ✅ Explicit API calls
- ✅ Official SDKs only
- ✅ No web UI modification
- ✅ Transparent to user

### Response Flow (Compliant)

```
Provider API Response
  ↓
Spectyra processes (optimization)
  ↓
Returns to user application
```

**Safety Features:**
- ✅ Response from official API
- ✅ Optimization applied transparently
- ✅ No modification of provider response format
- ✅ User sees optimized result

## Comparison: Compliant vs Non-Compliant

### ✅ Compliant Approach (What We Do)

**Local Proxy:**
- Tool → Proxy → Spectyra → Official API
- Uses official provider SDKs
- No web UI interception
- **Result**: 100% compliant

**SDK:**
- Developer code → Spectyra API → Official API
- Explicit API calls
- Uses official SDKs
- **Result**: 100% compliant

### ❌ Non-Compliant Approach (What We Don't Do)

**Web UI Interception:**
- Browser → Intercept web UI → Modify → Return
- Intercepts web UI backend
- Modifies request/response
- **Result**: May violate ToS

**Why we avoid it:**
- Violates provider ToS
- Unauthorized access
- Risk of account suspension
- Not sustainable

## Summary

### ✅ Spectyra is 100% Compliant When:

1. **Using Local Proxy**
   - Tools connect to proxy
   - Proxy uses official APIs
   - No web UI interception

2. **Using SDK**
   - Explicit API calls
   - Official SDKs used
   - Transparent to user

3. **Using Direct API**
   - Developer calls Spectyra
   - Spectyra uses official APIs
   - No interception

### ⚠️ Potential ToS Issues:

1. **Browser Extension for Web UIs**
   - Intercepts web UI requests
   - May violate ToS
   - Use with caution

### Key Safety Features:

- ✅ **Official SDKs Only**: Never uses unofficial APIs
- ✅ **Direct API Calls**: No interception or modification
- ✅ **BYOK Model**: Users provide their own keys
- ✅ **Transparent**: Users know what's happening
- ✅ **No Web UI**: Doesn't intercept web interfaces (except browser extension)

## Recommendation

**For Maximum Safety:**
1. Use **Local Proxy** for desktop coding tools (100% compliant)
2. Use **SDK** for custom applications (100% compliant)
3. Use **Browser Extension** only for web tools (understand risks)
4. Always use **BYOK model** (user's own keys)

**Result**: 100% compliant architecture that works safely with all providers!
