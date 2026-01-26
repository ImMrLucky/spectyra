# Spectyra Proxy Setup Guide

## For Developers Using Coding Assistants

This guide shows how to set up Spectyra Proxy to optimize your coding assistant API costs.

## Supported Tools

- ✅ GitHub Copilot
- ✅ Cursor
- ✅ Claude Code
- ✅ Codeium
- ✅ Tabnine
- ✅ Any OpenAI-compatible tool

## Step 1: Install and Start Proxy

```bash
cd tools/proxy
pnpm install
pnpm start
```

The proxy will start on:
- **Proxy:** http://localhost:3001
- **Dashboard:** http://localhost:3002

## Step 2: Configure Proxy

1. Open http://localhost:3002 in your browser
2. Go to "Configuration" tab
3. Enter:
   - **Spectyra API Key:** Your Spectyra API key
   - **Provider API Key:** Your OpenAI/Anthropic/etc. key (BYOK)
   - **Provider:** Select your provider
   - **Path:** "Code" (recommended for coding)
   - **Optimization Level:** 2-3 (balanced to aggressive)
4. Click "Save Configuration"

## Step 3: Configure Your Coding Tool

### GitHub Copilot

1. Set environment variable:
```bash
export OPENAI_API_BASE=http://localhost:3001/v1
```

2. Restart VS Code

**Or in VS Code settings.json:**
```json
{
  "github.copilot.advanced": {
    "api.baseUrl": "http://localhost:3001/v1"
  }
}
```

### Cursor

1. Open Cursor Settings
2. Search for "API"
3. Set "OpenAI API Base URL" to: `http://localhost:3001/v1`
4. Restart Cursor

### Claude Code

1. Open Claude Code settings
2. Set custom API endpoint: `http://localhost:3001/v1`
3. Restart Claude Code

### Codeium

1. Open Codeium settings
2. Set API endpoint: `http://localhost:3001/v1`
3. Restart VS Code/editor

## Step 4: Monitor Savings

1. Open dashboard: http://localhost:3002
2. Go to "Statistics" tab
3. See real-time:
   - Total requests
   - Tokens saved
   - Cost saved
   - Recent request history

## Verification

1. Use your coding assistant normally
2. Check dashboard - you should see requests appearing
3. See savings percentages (typically 40-65%)

## Troubleshooting

### Proxy not running
```bash
# Check if running
curl http://localhost:3001/health

# Should return: {"status":"ok","service":"spectyra-proxy"}
```

### Tool not connecting
- Verify proxy is running
- Check tool's API base URL setting
- Check tool logs for connection errors
- Ensure tool supports custom endpoints

### No savings showing
- Check configuration is saved
- Verify API keys are correct
- Check proxy console for errors
- Ensure optimization level > 0

### Configuration not saving
- Check file permissions
- Ensure `.spectyra-proxy-config.json` is writable
- Check proxy console for errors

## Advanced: Auto-Start on Boot

### macOS (launchd)

Create `~/Library/LaunchAgents/com.spectyra.proxy.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.spectyra.proxy</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/path/to/spectyra/tools/proxy/spectyra-proxy.ts</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
</dict>
</plist>
```

Then:
```bash
launchctl load ~/Library/LaunchAgents/com.spectyra.proxy.plist
```

### Linux (systemd)

Create `/etc/systemd/system/spectyra-proxy.service`:

```ini
[Unit]
Description=Spectyra Proxy
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/spectyra/tools/proxy
ExecStart=/usr/bin/node /path/to/spectyra/tools/proxy/spectyra-proxy.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable spectyra-proxy
sudo systemctl start spectyra-proxy
```

## Next Steps

- Monitor savings in dashboard
- Adjust optimization level if needed
- Share feedback and improvements!
