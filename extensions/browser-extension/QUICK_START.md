# Browser Extension Quick Start

## For End Users

### Installation

1. **From Chrome Web Store** (when published):
   - Visit Chrome Web Store
   - Search "Spectyra"
   - Click "Add to Chrome"
   - Confirm installation

2. **From Edge Add-ons** (when published):
   - Visit Edge Add-ons
   - Search "Spectyra"
   - Click "Get"
   - Confirm installation

3. **Development/Unpacked** (for testing):
   - Download extension files
   - Go to `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the extension folder

### First-Time Setup

1. **Get Your Spectyra API Key:**
   - Go to [Spectyra](https://your-spectyra-app.netlify.app)
   - Sign up for an account
   - **Save your API key** (shown only once!)

2. **Configure Extension:**
   - Click the Spectyra extension icon in your browser
   - Click "Settings" (or right-click icon → Options)
   - Enter:
     - **Spectyra API URL**: `https://spectyra.up.railway.app/v1`
     - **Spectyra API Key**: Paste your API key
     - **Provider API Key**: Your OpenAI/Anthropic/etc. key (BYOK)
     - **Path**: Choose "Talk" for chat or "Code" for coding
     - **Optimization Level**: Start with 2 (Balanced)
   - Click "Save"

3. **Enable Extension:**
   - Click the extension icon
   - Toggle "Enabled" to ON
   - Extension is now active!

### Using the Extension

1. **Visit any LLM-powered site:**
   - ChatGPT (chat.openai.com)
   - Claude (claude.ai)
   - Or any site using OpenAI/Anthropic/Gemini/Grok APIs

2. **Use normally:**
   - Make requests as you normally would
   - Extension automatically optimizes in the background

3. **See savings:**
   - Look for the savings widget overlay on the page
   - Click extension icon to see session totals
   - Check savings breakdown by request

### Tips

- **For Chat/Q&A**: Use "Talk" path, Level 2-3
- **For Coding**: Use "Code" path, Level 3-4 (but consider SDK for better results)
- **Start conservative**: Begin with Level 2, increase if quality is good
- **Monitor savings**: Check extension popup regularly

### Troubleshooting

**Extension not working?**
- Check it's enabled in popup
- Verify API keys are correct
- Check browser console for errors

**No savings showing?**
- Ensure optimization level > 0
- Check that requests are being intercepted
- Verify Spectyra API is accessible

**Requests failing?**
- Check provider API key is valid
- Verify Spectyra API key is correct
- Check network connectivity
