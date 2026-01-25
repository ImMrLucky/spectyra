# Browser Extension Deployment Guide

## Prerequisites

1. **Icons**: Create extension icons in `icons/` directory:
   - `icon16.png` (16x16 pixels)
   - `icon48.png` (48x48 pixels)
   - `icon128.png` (128x128 pixels)
   - Use your Spectyra logo/branding

2. **Update API URL**: Ensure `manifest.json` has correct Spectyra API URL:
   ```json
   "host_permissions": [
     "https://spectyra.up.railway.app/*",
     "http://localhost:8080/*"  // For development
   ]
   ```

## Development Testing

### Load Unpacked Extension

1. **Chrome/Edge:**
   - Open `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top-right)
   - Click "Load unpacked"
   - Select the `extensions/browser-extension` directory
   - Extension should appear in your extensions list

2. **Configure:**
   - Click the extension icon
   - Click "Settings" (or right-click → Options)
   - Enter:
     - Spectyra API URL: `https://spectyra.up.railway.app/v1` (or `http://localhost:8080/v1` for dev)
     - Spectyra API Key: Your API key from registration
     - Provider API Key: Your OpenAI/Anthropic/etc. key (BYOK)
     - Path: "Talk" or "Code"
     - Optimization Level: 0-4
   - Click "Save"

3. **Test:**
   - Visit ChatGPT, Claude, or any site using LLM APIs
   - Make a request
   - Check for savings widget overlay
   - Check extension popup for session savings

## Production Deployment

### Option 1: Chrome Web Store

1. **Prepare Package:**
   ```bash
   cd extensions/browser-extension
   # Create zip (exclude .git, node_modules, etc.)
   zip -r spectyra-extension.zip . -x "*.git*" "node_modules/*" "*.md"
   ```

2. **Create Developer Account:**
   - Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
   - Pay one-time $5 registration fee
   - Verify identity

3. **Submit Extension:**
   - Click "New Item"
   - Upload `spectyra-extension.zip`
   - Fill out store listing:
     - Name: "Spectyra - LLM Cost Optimizer"
     - Description: (see below)
     - Category: Productivity
     - Screenshots: Create screenshots showing:
       - Extension popup with savings
       - Savings widget on a page
       - Options page
     - Privacy policy URL: (required)
     - Single purpose: "Optimize LLM API calls to reduce token usage"
   - Submit for review (typically 1-3 business days)

4. **Store Listing Description:**
   ```
   Spectyra automatically optimizes your LLM API calls to reduce token usage and cost by 40-65% without losing quality.

   Features:
   - Automatic interception of OpenAI, Anthropic, Gemini, and Grok API calls
   - Real-time savings tracking
   - Bring Your Own Key (BYOK) - uses your existing provider keys
   - Configurable optimization levels (0-4)
   - Works with ChatGPT, Claude, and other LLM-powered tools

   Privacy: All provider API keys are stored locally and never sent to Spectyra servers.
   ```

### Option 2: Edge Add-ons

1. **Prepare Package:** (same as Chrome)

2. **Create Developer Account:**
   - Go to [Partner Center](https://partner.microsoft.com/dashboard)
   - Register as Edge extension developer

3. **Submit Extension:**
   - Similar process to Chrome Web Store
   - Upload zip package
   - Fill out listing information
   - Submit for review

### Option 3: Direct Distribution (Enterprise/Internal)

1. **Package as .crx:**
   ```bash
   # Chrome will create .crx when you pack extension
   # Or use: chrome --pack-extension=./browser-extension
   ```

2. **Distribute:**
   - Host .crx file on your server
   - Users install via "Load unpacked" → "Load extension" → select .crx
   - Or use enterprise policy to auto-install

## Version Updates

1. **Update version in `manifest.json`:**
   ```json
   "version": "0.1.1"
   ```

2. **Create new zip package**

3. **Submit update to store:**
   - Go to extension dashboard
   - Click "Upload new package"
   - Upload new zip
   - Submit for review

## Checklist Before Deployment

- [ ] Icons created (16x16, 48x48, 128x128)
- [ ] API URL updated in manifest.json
- [ ] Tested in development mode
- [ ] Privacy policy URL ready (required for Chrome Web Store)
- [ ] Screenshots created for store listing
- [ ] Description and metadata prepared
- [ ] Extension tested on multiple sites (ChatGPT, Claude, etc.)
- [ ] Error handling tested
- [ ] Settings page works correctly
- [ ] Savings widget displays correctly

## Troubleshooting Deployment

### Chrome Web Store Rejection

Common reasons:
- Missing privacy policy URL
- Permissions not justified in description
- Missing screenshots
- Extension doesn't work as described

**Fix:** Update description to clearly explain why each permission is needed:
- `storage`: Store API keys and settings locally
- `webRequest`: Intercept LLM API calls
- `scripting`: Inject savings widget
- `tabs`: Track session savings

### Extension Not Loading

- Check manifest.json syntax (use JSON validator)
- Ensure all referenced files exist
- Check browser console for errors
- Verify permissions are correct

### Icons Not Showing

- Ensure icons exist in `icons/` directory
- Verify paths in manifest.json match actual files
- Check file formats (PNG recommended)
