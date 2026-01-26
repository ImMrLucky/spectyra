# Spectyra Proxy

Local proxy server that provides an OpenAI-compatible endpoint, routing requests through Spectyra for automatic optimization. Works with GitHub Copilot, Cursor, Claude Code, and other coding assistants.

## Features

- ✅ **OpenAI-compatible API** - Works with any tool that uses OpenAI API
- ✅ **Automatic optimization** - Routes through Spectyra for 40-65% token savings
- ✅ **Real-time dashboard** - Web UI showing savings and stats
- ✅ **Configuration management** - Easy setup via web dashboard
- ✅ **BYOK support** - Use your own API keys

## Installation

```bash
# Install dependencies
pnpm install

# Or with npm
npm install
```

## Quick Start

1. **Start the proxy:**
```bash
pnpm start
# or
npm start
```

2. **Configure via dashboard:**
   - Open http://localhost:3002 in your browser
   - Enter your Spectyra API key
   - Enter your provider API key (OpenAI, Anthropic, etc.)
   - Select provider and optimization settings
   - Click "Save Configuration"

3. **Configure your coding tool:**
   - Set `OPENAI_API_BASE=http://localhost:3001/v1`
   - Or configure in your tool's settings

## Usage

### With GitHub Copilot

1. Set environment variable:
```bash
export OPENAI_API_BASE=http://localhost:3001/v1
```

2. Restart VS Code/Copilot

### With Cursor

1. Open Cursor settings
2. Set API base URL to: `http://localhost:3001/v1`
3. Restart Cursor

### With Claude Code

1. Configure Claude Code to use custom API endpoint
2. Set endpoint to: `http://localhost:3001/v1`

## Dashboard

Access the dashboard at: **http://localhost:3002**

**Features:**
- Real-time savings statistics
- Recent request history
- Configuration management
- Live updates every 2 seconds

## Configuration

### Environment Variables

- `PROXY_PORT` - Proxy server port (default: 3001)
- `DASHBOARD_PORT` - Dashboard port (default: 3002)
- `SPECTYRA_API_URL` - Spectyra API URL (default: https://spectyra.up.railway.app/v1)

### Configuration File

Configuration is saved to `.spectyra-proxy-config.json` in the proxy directory.

**Fields:**
- `spectyraKey` - Your Spectyra API key
- `providerKey` - Your provider API key (BYOK)
- `provider` - Provider name (openai, anthropic, gemini, grok)
- `path` - Optimization path (code, talk)
- `optimizationLevel` - Optimization level (0-4)

## API Endpoints

### Proxy Endpoint
- `POST /v1/chat/completions` - OpenAI-compatible chat endpoint

### Configuration
- `GET /config` - Get current configuration (without keys)
- `POST /config` - Update configuration

### Statistics
- `GET /stats` - Get usage statistics and savings

### Health Check
- `GET /health` - Check proxy status

## How It Works

```
Your Coding Tool (Copilot/Cursor/etc)
  → Local Proxy (localhost:3001)
    → Spectyra API (optimization)
      → Provider API (OpenAI/Anthropic)
        → Optimized Response
          → Your Tool
```

**Benefits:**
- Transparent optimization
- No code changes needed
- Real-time savings tracking
- Works with any OpenAI-compatible tool

## Troubleshooting

### Proxy not starting
- Check if ports 3001 and 3002 are available
- Try different ports via environment variables

### Configuration not saving
- Check file permissions in proxy directory
- Ensure `.spectyra-proxy-config.json` is writable

### Tool not connecting
- Verify proxy is running: `curl http://localhost:3001/health`
- Check tool's API base URL setting
- Ensure tool supports custom API endpoints

### No savings showing
- Verify configuration is correct
- Check Spectyra API key is valid
- Check provider API key is valid
- Look at proxy console for errors

## Development

```bash
# Watch mode (auto-restart on changes)
pnpm dev

# Build TypeScript
pnpm build
```

## License

MIT
