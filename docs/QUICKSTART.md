# Spectyra Quick Start Guide

## Prerequisites

- Node.js 18+ and pnpm installed
- API keys for at least one provider (OpenAI, Anthropic, Gemini, or Grok)

## Setup

1. **Install dependencies:**
```bash
pnpm install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env and add your API keys
```

3. **Start the API server:**
```bash
pnpm dev:api
```

The API will run on http://localhost:8080

4. **Start the Angular UI (in another terminal):**
```bash
pnpm dev:web
```

The UI will run on http://localhost:4200

## Usage

### Web UI

1. Open http://localhost:4200
2. Navigate to "Scenarios"
3. Select a scenario (Talk or Code)
4. Choose a provider and model
5. Click "Run Replay" to see baseline vs optimized comparison

### CLI

```bash
# Talk workflow
cd tools/cli
pnpm install
pnpm dev spectyra talk -i "Your question here" -p openai -m gpt-4o-mini

# Code workflow
pnpm dev spectyra code -f ./path/to/file.ts -p anthropic -m claude-3-5-sonnet-20241022

# Replay scenario
pnpm dev spectyra replay -s talk_support_refund_001 -p openai
```

### Local Proxy

For tools that support OpenAI-compatible endpoints:

```bash
cd tools/proxy
pnpm install
pnpm start
```

Then set `OPENAI_API_BASE=http://localhost:3001/v1` in your tool configuration.

## Architecture

- **apps/api**: Express backend with spectral core optimizer
- **apps/web**: Angular frontend
- **packages/shared**: Shared types
- **tools/proxy**: Local OpenAI-compatible proxy
- **tools/cli**: Command-line interface

## Key Features

- **Spectral Core v0**: Graph-based stability analysis
- **Multi-provider**: OpenAI, Anthropic, Gemini, Grok
- **Talk & Code paths**: Different optimization policies
- **Replay mode**: Compare baseline vs optimized
- **Quality guards**: Ensure outputs meet requirements

## Troubleshooting

- **API errors**: Check that API keys are set in `.env`
- **Database errors**: Ensure `./data` directory is writable
- **UI not loading**: Check that API is running on port 8080
- **Provider errors**: Verify API keys are valid and have credits
