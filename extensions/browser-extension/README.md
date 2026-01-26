# Spectyra Browser Extension

## ⚠️ Terms of Service Warning

**Using this extension may violate ChatGPT's and other LLM providers' Terms of Service.**

**Risks:**
- Account suspension or ban
- Service disruption
- Detection is possible despite stealth features

**Use at your own risk.** See `TOS_WARNING.md` for details.

---

# Spectyra Browser Extension

Chrome/Edge browser extension (MV3) that intercepts LLM API calls and routes them through Spectyra for automatic token optimization.

## Features

- **Automatic Interception**: Intercepts fetch requests to OpenAI, Anthropic, Gemini, and Grok APIs
- **Transparent Routing**: Routes requests through Spectyra without breaking existing code
- **Savings Widget**: Shows real-time savings overlay on each optimized call
- **Session Tracking**: Tracks total savings across all calls in a session
- **BYOK Support**: Uses your own provider API keys (stored locally only)
- **Configurable**: Adjust optimization level and path (talk/code) via options page

## Installation

### Development

1. Open Chrome/Edge and navigate to `chrome://extensions/` (or `edge://extensions/`)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extensions/browser-extension` directory

### Production

1. Build the extension (if needed)
2. Package as `.crx` or `.zip`
3. Submit to Chrome Web Store / Edge Add-ons

## Configuration

1. Click the Spectyra extension icon
2. Click "Settings"
3. Enter:
   - **Spectyra API URL**: Your Spectyra API endpoint
   - **Spectyra API Key**: Your Spectyra API key
   - **Provider API Key**: Your LLM provider key (BYOK - stored locally)
   - **Path**: "Talk" for chat/Q&A, "Code" for coding workflows
   - **Optimization Level**: 0-4 (higher = more aggressive)

## How It Works

1. **Content Script Injection**: Injected into all pages at document start
2. **Fetch Interception**: Intercepts `window.fetch` calls
3. **Provider Detection**: Detects LLM provider from URL (OpenAI, Anthropic, etc.)
4. **Request Parsing**: Extracts model and messages from request
5. **Spectyra Call**: Sends request to Spectyra API with optimization
6. **Response Transformation**: Converts Spectyra response back to provider format
7. **Savings Display**: Shows widget with savings metrics

## Supported Providers

- **OpenAI** (`api.openai.com`)
- **Anthropic** (`api.anthropic.com`)
- **Gemini** (`generativelanguage.googleapis.com`)
- **Grok** (`api.x.ai`)

## Privacy & Security

- Provider API keys are stored locally in browser storage (sync storage)
- Keys are never sent to Spectyra servers (only used for provider calls)
- All optimization happens server-side
- No data is logged or stored by the extension

## Troubleshooting

### Extension Not Working

1. Check that extension is enabled in popup
2. Verify Spectyra API key is set correctly
3. Check browser console for errors
4. Ensure provider API key is valid

### Requests Not Being Intercepted

1. Some sites may use `XMLHttpRequest` instead of `fetch`
2. Some sites may use WebSockets (not supported yet)
3. Check that the site is making requests to supported providers

### Savings Not Showing

1. Verify Spectyra API is responding correctly
2. Check that optimization level is set appropriately
3. Some requests may not benefit from optimization (too short, etc.)

## Development

### File Structure

```
browser-extension/
  manifest.json          # Extension manifest (MV3)
  background.js          # Service worker (settings, session tracking)
  content.js             # Content script (fetch interception)
  popup.html/js          # Extension popup UI
  options.html/js        # Settings page
  icons/                 # Extension icons
```

### Building

No build step required for basic functionality. For production:

1. Minify JavaScript files
2. Optimize icons
3. Package as `.zip` for store submission

## License

MIT
