# Spectyra Enterprise Proxy

Secure, enterprise-grade local proxy for routing OpenAI-compatible requests through Spectyra's AI Gateway. Designed for teams, gateways, and IDE tools.

## Features

- ✅ **OpenAI-compatible API** - Works with any tool using OpenAI API format
- ✅ **Automatic optimization** - Routes through Spectyra for 40-65% token savings
- ✅ **Secure by default** - Binds to localhost, no key logging, redacted errors
- ✅ **Auto path detection** - Automatically detects "talk" vs "code" conversations
- ✅ **Pass-through fallback** - Optional direct-to-provider mode if Spectyra unavailable
- ✅ **Enterprise-ready** - Environment variable configuration, no file storage

## Installation

```bash
npm install -g spectyra-proxy
```

## Quick Start

1. **Set environment variables:**

```bash
export SPECTYRA_API_URL="https://spectyra.up.railway.app/v1"
export SPECTYRA_API_KEY="sk_spectyra_..."
export OPENAI_API_KEY="sk-..."  # Optional, for pass-through mode
export ANTHROPIC_API_KEY="sk-ant-..."  # Optional, for Anthropic
```

2. **Start the proxy:**

```bash
spectyra-proxy
```

3. **Configure your IDE tool:**

Set your tool's API base URL to: `http://localhost:3001/v1`

## Enterprise Usage

### Teams & Gateways

The proxy is designed for enterprise deployment:

- **Local deployment**: Run on developer machines or in containerized environments
- **Gateway mode**: Deploy as a central gateway for multiple developers
- **No code changes**: Works transparently with existing OpenAI-compatible tools

### IDE Tools Integration

Works with:
- **GitHub Copilot** - Set `OPENAI_API_BASE=http://localhost:3001/v1`
- **Cursor** - Configure custom API endpoint
- **Claude Code** - Use `/v1/messages` endpoint
- **Any OpenAI-compatible tool** - Point to localhost proxy

### Security

**Secure by default:**
- Binds to `127.0.0.1` (localhost only)
- Never logs API keys or prompts
- Redacts sensitive data in errors
- Domain allowlist for outbound requests

**Security settings:**
- `ALLOW_REMOTE_BIND=false` (default) - Only localhost access
- `DEBUG_LOG_PROMPTS=false` (default) - No prompt logging
- `ENABLE_PASSTHROUGH=false` (default) - No direct provider calls

## Configuration

### Required Environment Variables

- `SPECTYRA_API_URL` - Spectyra API endpoint (default: `https://spectyra.up.railway.app/v1`)
- `SPECTYRA_API_KEY` - Your Spectyra org/project API key

### Optional Environment Variables

- `OPENAI_API_KEY` - OpenAI API key (for pass-through mode)
- `ANTHROPIC_API_KEY` - Anthropic API key (for Anthropic provider)
- `PROXY_PORT` - Proxy server port (default: `3001`)
- `SPECTYRA_OPT_LEVEL` - Optimization level 0-4 (default: `2`)
- `SPECTYRA_RESPONSE_LEVEL` - Response optimization level (default: `2`)
- `SPECTYRA_MODE` - Mode: `optimized` or `baseline` (default: `optimized`)

### Security Environment Variables

- `ALLOW_REMOTE_BIND` - Set to `true` to allow remote connections (default: `false`)
- `DEBUG_LOG_PROMPTS` - Set to `true` to log prompts (default: `false`)
- `ENABLE_PASSTHROUGH` - Set to `true` to enable direct provider fallback (default: `false`)

## API Endpoints

### Proxy Endpoints

- `POST /v1/chat/completions` - OpenAI-compatible chat endpoint
- `POST /v1/messages` - Anthropic-compatible messages endpoint

### Utility Endpoints

- `GET /health` - Health check and configuration status

## How It Works

```
Your IDE Tool (Copilot/Cursor/etc)
  → Local Proxy (localhost:3001)
    → Spectyra API (optimization)
      → Provider API (OpenAI/Anthropic)
        → Optimized Response
          → Your Tool
```

**Key Features:**
- **Auto path detection**: Analyzes messages to detect "talk" vs "code"
- **Provider detection**: Automatically detects provider from model name
- **Format conversion**: Handles OpenAI, Anthropic, and Gemini formats
- **Pass-through mode**: Optional fallback to direct provider calls

## Path Detection

The proxy automatically detects whether a conversation is "talk" (conversational) or "code" (programming):

- **Code indicators**: Code blocks, function definitions, imports, etc.
- **Talk indicators**: Questions, explanations, discussions
- **Default**: Falls back to "code" for coding tools

## Pass-Through Mode

If `ENABLE_PASSTHROUGH=true` and Spectyra is unavailable, the proxy will:

1. Attempt Spectyra API call
2. If Spectyra fails, fall back to direct provider API
3. Return provider response in original format

**Use case**: High availability requirements where direct provider access is acceptable.

## Security Best Practices

1. **Never expose the proxy publicly** - Keep `ALLOW_REMOTE_BIND=false`
2. **Use environment variables** - Never hardcode API keys
3. **Rotate keys regularly** - Update `SPECTYRA_API_KEY` periodically
4. **Monitor logs** - Check for unauthorized access attempts
5. **Use pass-through sparingly** - Only enable if necessary

## Troubleshooting

### Proxy not starting

- Check if port 3001 is available
- Verify `SPECTYRA_API_KEY` is set
- Check firewall settings if using remote bind

### Tool not connecting

- Verify proxy is running: `curl http://localhost:3001/health`
- Check tool's API base URL setting
- Ensure tool supports custom API endpoints

### No optimization

- Verify `SPECTYRA_API_KEY` is valid
- Check Spectyra API is reachable
- Review proxy logs for errors

### Pass-through mode issues

- Ensure provider API key is set (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`)
- Verify `ENABLE_PASSTHROUGH=true`
- Check provider API is accessible

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Build for distribution
npm run build
```

## Important Notes

⚠️ **Do not use SDK in browser** - The proxy is designed for server-side/local use only.

⚠️ **Provider keys are ephemeral** - Keys are passed per-request and never stored.

⚠️ **Enterprise deployment** - For production, deploy in containerized environments with proper security controls.

## License

MIT
