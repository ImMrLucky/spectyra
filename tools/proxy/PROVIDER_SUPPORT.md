# Provider Support Guide

## Supported Providers

The Spectyra Proxy supports **all major LLM providers** used by coding tools:

### ✅ OpenAI
**Tools:**
- GitHub Copilot
- Cursor (when using OpenAI models)
- Codeium (OpenAI mode)
- Tabnine (OpenAI mode)

**API Format:** OpenAI-compatible (`/v1/chat/completions`)
**Configuration:** Select "OpenAI" in dashboard

### ✅ Anthropic (Claude)
**Tools:**
- Claude Code
- Cursor (when using Claude models)
- Tools using Claude API

**API Format:** Anthropic Messages API (`/v1/messages`)
**Configuration:** Select "Anthropic" in dashboard

**Note:** The proxy automatically handles Anthropic's different API format.

### ✅ Gemini
**Tools:**
- Google AI Studio tools
- Tools using Gemini API

**API Format:** Gemini GenerateContent API
**Configuration:** Select "Gemini" in dashboard

### ✅ Grok
**Tools:**
- X.AI tools
- Tools using Grok API

**API Format:** OpenAI-compatible (`/v1/chat/completions`)
**Configuration:** Select "Grok" in dashboard

## How It Works

The proxy automatically:

1. **Detects API format** from the request
2. **Converts to Spectyra format** for optimization
3. **Routes through Spectyra** with your configured provider
4. **Converts back to original format** for your tool

**You don't need to worry about API format differences!**

## Configuration

### Step 1: Select Provider

In the dashboard (http://localhost:3002), select your provider:
- **OpenAI** - For Copilot, Cursor (OpenAI), etc.
- **Anthropic** - For Claude Code, Cursor (Claude), etc.
- **Gemini** - For Google AI tools
- **Grok** - For X.AI tools

### Step 2: Enter API Keys

- **Spectyra API Key:** Your Spectyra key
- **Provider API Key:** Your provider key (OpenAI, Anthropic, etc.)

### Step 3: Configure Tool

Set your tool's API endpoint to: `http://localhost:3001/v1`

**The proxy handles format conversion automatically!**

## Tool-Specific Setup

### GitHub Copilot (OpenAI)
```bash
export OPENAI_API_BASE=http://localhost:3001/v1
```
Provider: **OpenAI**

### Claude Code (Anthropic)
Configure Claude Code to use: `http://localhost:3001/v1/messages`
Provider: **Anthropic**

### Cursor
- If using OpenAI models: Provider = **OpenAI**
- If using Claude models: Provider = **Anthropic**
- Set API base: `http://localhost:3001/v1`

### Codeium
- If using OpenAI: Provider = **OpenAI**
- Set API endpoint: `http://localhost:3001/v1`

## API Format Conversion

The proxy automatically converts between formats:

### OpenAI → Spectyra → OpenAI
```
OpenAI format (messages array)
  ↓
Spectyra format (standardized)
  ↓
OpenAI format (response)
```

### Anthropic → Spectyra → Anthropic
```
Anthropic format (messages with content arrays)
  ↓
Spectyra format (standardized)
  ↓
Anthropic format (message object)
```

### Gemini → Spectyra → Gemini
```
Gemini format (contents with parts)
  ↓
Spectyra format (standardized)
  ↓
Gemini format (candidates)
```

## Troubleshooting

### Tool not connecting
- Verify provider is correct in dashboard
- Check tool's API endpoint setting
- Ensure proxy is running

### Wrong format errors
- The proxy should auto-detect, but if issues occur:
  - Check provider selection in dashboard
  - Verify tool is using correct endpoint
  - Check proxy console for format detection logs

### Provider-specific issues

**Anthropic:**
- Ensure you're using `/v1/messages` endpoint
- System messages are handled automatically

**Gemini:**
- Verify API key format
- Check model name is correct

**OpenAI/Grok:**
- Standard `/v1/chat/completions` endpoint
- Should work with most tools

## Summary

✅ **All providers supported** - OpenAI, Anthropic, Gemini, Grok
✅ **Automatic format conversion** - No manual configuration needed
✅ **Works with all coding tools** - Copilot, Cursor, Claude Code, etc.
✅ **Simple setup** - Just select provider in dashboard

**The proxy handles all the complexity for you!**
