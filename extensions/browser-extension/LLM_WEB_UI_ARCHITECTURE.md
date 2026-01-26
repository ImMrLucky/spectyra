# LLM Web UI Architecture & Interception Challenges

## The Problem

Most LLM web interfaces (ChatGPT, Claude, Gemini, etc.) use a **two-tier architecture**:

```
Browser → Web UI Backend API → LLM Provider API
```

This means:
- The browser calls the web UI's own backend (e.g., `chatgpt.com/backend-api/`)
- The backend then calls the actual LLM provider API server-side
- **We can't intercept the actual LLM API calls from the browser** - they happen server-side

## Different LLM Web Interfaces

### 1. ChatGPT (OpenAI)
- **Pattern**: `chatgpt.com/backend-api/...` → OpenAI API (server-side)
- **Challenge**: Custom API format, requires transformation
- **Status**: Can intercept backend API calls, but need to understand their format

### 2. Claude (Anthropic)
- **Pattern**: `claude.ai/api/...` or similar → Anthropic API (server-side)
- **Challenge**: Likely similar to ChatGPT - custom backend
- **Status**: Unknown format, would need investigation

### 3. Gemini
- **Pattern**: `gemini.google.com/...` → Google API (server-side)
- **Challenge**: Google's own backend format
- **Status**: Unknown format

### 4. Grok
- **Pattern**: `x.ai/...` → Grok API (server-side)
- **Challenge**: Custom backend
- **Status**: Unknown format

## What We CAN Intercept

### ✅ Direct Provider API Calls
When applications call the provider APIs directly:
- `api.openai.com/v1/chat/completions` ✅
- `api.anthropic.com/v1/messages` ✅
- `generativelanguage.googleapis.com/v1/...` ✅
- `api.x.ai/v1/...` ✅

**Use cases:**
- Custom applications using provider SDKs
- Scripts and tools
- Integrations
- Developer tools

### ❌ Web UI Backend APIs (Complex)
When web UIs use their own backend:
- `chatgpt.com/backend-api/...` ⚠️ (requires format transformation)
- `claude.ai/api/...` ⚠️ (unknown format)
- `gemini.google.com/...` ⚠️ (unknown format)

**Challenges:**
- Each has a different API format
- Need to transform requests/responses
- May require reverse engineering
- Format may change without notice

## Current Implementation

The extension currently intercepts:
1. **Direct provider API calls** - Works perfectly ✅
2. **ChatGPT backend API** - Partially implemented (needs format handling) ⚠️
3. **Other web UIs** - Not yet implemented ❌

## Recommendations

### Option 1: Focus on Direct API Calls (Recommended)
- **Pros**: Works reliably, standard formats, no reverse engineering
- **Cons**: Doesn't work with web UIs
- **Best for**: Developers, custom apps, integrations

### Option 2: Support Web UI Backends (Complex)
- **Pros**: Works with popular web UIs
- **Cons**: 
  - Requires reverse engineering each UI
  - Formats may change
  - More maintenance
  - May break with UI updates
- **Best for**: End users using web UIs

### Option 3: Hybrid Approach
- Support direct API calls (primary)
- Add web UI support incrementally
- Document which UIs are supported

## For ChatGPT Specifically

To make ChatGPT work, we need to:
1. ✅ Detect ChatGPT backend API calls (done)
2. ⚠️ Parse ChatGPT's request format (in progress)
3. ⚠️ Transform to Spectyra format
4. ⚠️ Transform Spectyra response back to ChatGPT format
5. ⚠️ Handle streaming responses (if ChatGPT uses them)

**Current Status**: Detection works, but format transformation needs work.

## Next Steps

1. **Identify the actual chat POST endpoint** in ChatGPT
2. **Understand the request/response format**
3. **Implement format transformation**
4. **Test with real ChatGPT conversations**

Would you like to:
- A) Focus on making ChatGPT work (reverse engineer their format)
- B) Focus on direct API calls (works for custom apps)
- C) Support both (more work, but broader coverage)
