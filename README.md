# Spectyra — Spectral Token & Cost Reduction Engine

A middleware + dashboard that reduces token usage and cost by preventing semantic recomputation.

## Quick Start

1. Install dependencies:
```bash
pnpm install
```

2. Copy `.env.example` to `.env` and fill in your API keys:
```bash
cp .env.example .env
```

3. Start the API server:
```bash
pnpm dev:api
```

4. Start the Angular UI (in another terminal):
```bash
pnpm dev:web
```

5. Open http://localhost:4200

## Architecture

- **apps/api**: Express backend with provider adapters, spectral core, optimizer
- **apps/web**: Angular frontend with scenarios, replay, and runs history
- **packages/shared**: Shared types and utilities
- **tools/proxy**: Local OpenAI-compatible proxy
- **tools/cli**: CLI wrapper for code workflows

## Features

- **Multi-provider support**: OpenAI, Anthropic, Gemini, Grok
- **Spectral Core v1**: Multi-operator graph-based stability analysis for intelligent context reuse
- **Talk & Code paths**: Different optimization policies for chat vs coding
- **Replay mode**: Compare baseline vs optimized on benchmark scenarios
- **Proof mode**: Paste conversations to estimate savings without LLM calls
- **Quality guards**: Ensure savings don't come from missing required outputs
- **Browser Extension**: Automatic optimization for web-based LLM tools
- **SDK**: Easy integration for applications and coding workflows
- **BYOK**: Bring Your Own Key - use your existing provider accounts

## Quick Links

- **[User Guide](USER_GUIDE.md)** - How to use Spectyra (browser extension, SDK, API)
- **[Application Description](APPLICATION_DESCRIPTION.md)** - Complete technical documentation
- **[Browser Extension Deployment](extensions/browser-extension/DEPLOYMENT.md)** - How to deploy the extension
- **[SDK Documentation](packages/sdk/README.md)** - SDK usage and examples

## Integration Options

### 🖥️ For Web Tools (ChatGPT, Claude Web, etc.)
👉 **Use Browser Extension** - Automatic optimization, zero code changes

**When to use:**
- Using ChatGPT, Claude Web, or other web-based LLM tools
- General chat/Q&A work
- Quick code questions in browser
- Want zero setup, just works

**Setup:**
1. Install from Chrome Web Store / Edge Add-ons
2. Configure API keys once
3. Works automatically on all LLM calls

**See:** [User Guide - Browser Extension](USER_GUIDE.md#option-a-browser-extension-recommended-for-web-tools)

---

### 💻 For Coding Workflows (Recommended)
👉 **Use SDK + API** - Best for code integration

**When to use:**
- Building applications that use LLMs
- Serious coding work (bug fixes, refactoring)
- Integrating into development tools
- Need code-specific optimizations

**Why SDK for coding:**
- ✅ AST-aware code slicing (extracts function signatures)
- ✅ Patch mode (unified diffs, huge savings)
- ✅ Better code context detection
- ✅ Full programmatic control
- ✅ Integrates with your codebase

**Setup:**
```bash
npm install @spectyra/sdk
```

**See:** [User Guide - SDK](USER_GUIDE.md#option-b-sdk--api-recommended-for-code-integration) | [SDK Docs](packages/sdk/README.md)

---

### 🔧 For Custom Integrations
👉 **Use Direct API** - Maximum flexibility

**When to use:**
- Non-JavaScript environments
- Custom HTTP clients
- Maximum control

**See:** [User Guide - Direct API](USER_GUIDE.md#option-c-direct-api-calls-for-custom-integrations)

---

## Quick Decision Guide

| Your Situation | Use This | Why |
|---------------|----------|-----|
| Using ChatGPT/Claude web | Browser Extension | Zero setup, automatic |
| Building an app with LLMs | SDK + API | Full control, better features |
| Coding workflows (bugs, refactoring) | **SDK + API** | Code-specific optimizations |
| General chat/Q&A | Browser Extension | Easiest |
| Custom/Non-JS integration | Direct API | Maximum flexibility |

**💡 Pro Tip:** For coding, SDK gives you AST-aware slicing and patch mode that can save 50-70% on code-related LLM calls!
