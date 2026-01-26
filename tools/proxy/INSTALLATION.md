# Installation Guide for End Users

## How to Install Spectyra Proxy

### Option 1: Install via npm (Recommended - When Published)

**Once the package is published to npm:**

```bash
npm install -g spectyra-proxy
```

**Then start it:**
```bash
spectyra-proxy
```

**That's it!** The proxy will start on:
- Proxy: http://localhost:3001
- Dashboard: http://localhost:3002

### Option 2: Install from GitHub (Current Method)

**If the npm package isn't published yet:**

1. **Clone or download the repository:**
   ```bash
   git clone https://github.com/your-username/spectyra.git
   cd spectyra/tools/proxy
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Start the proxy:**
   ```bash
   npm start
   # or
   pnpm start
   ```

### Option 3: Download Standalone (Future)

**When available, you can download a standalone installer:**
- macOS: `.dmg` installer
- Windows: `.exe` installer
- Linux: `.deb` or `.rpm` package

## Requirements

- **Node.js**: Version 18 or higher
- **npm** or **pnpm**: For package installation
- **Terminal/Command Prompt**: To run commands

## Verify Installation

After starting, you should see:
```
🚀 Spectyra Proxy running on http://localhost:3001
📊 Dashboard: http://localhost:3002
```

Open http://localhost:3002 to verify the dashboard is working.

## Next Steps

1. Configure the proxy (see Step 2 in Connections page)
2. Configure your coding tool (see Step 3 in Connections page)
3. Start coding and see savings!

## Troubleshooting

### "Command not found: spectyra-proxy"
- Make sure you installed globally: `npm install -g spectyra-proxy`
- Try: `npx @spectyra/proxy` instead

### "Port already in use"
- Another process is using port 3001 or 3002
- Stop that process or change ports via environment variables:
  ```bash
  PROXY_PORT=3003 DASHBOARD_PORT=3004 spectyra-proxy
  ```

### "Cannot find module"
- Make sure you ran `npm install` in the proxy directory
- Try deleting `node_modules` and running `npm install` again

## Need Help?

- See: `README.md` for detailed documentation
- See: `SETUP_GUIDE.md` for tool-specific setup
- See: `PROVIDER_SUPPORT.md` for provider information
