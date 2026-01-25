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
- **Spectral Core v0**: Graph-based stability index for intelligent context reuse
- **Talk & Code paths**: Different optimization policies for chat vs coding
- **Replay mode**: Compare baseline vs optimized on benchmark scenarios
- **Quality guards**: Ensure savings don't come from missing required outputs
