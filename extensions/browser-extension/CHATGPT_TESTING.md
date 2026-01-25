# Testing with ChatGPT

## Quick Start

1. **Reload the extension**:
   - Go to `chrome://extensions/` (or `edge://extensions/`)
   - Find "Spectyra - LLM Cost Optimizer"
   - Click the reload icon (circular arrow)

2. **Configure settings**:
   - Click the extension icon
   - Click "Settings"
   - Enter:
     - **Spectyra API URL**: `https://spectyra.up.railway.app/v1`
     - **Spectyra API Key**: Your Spectyra API key
     - **Provider API Key**: Your OpenAI API key (this is your ChatGPT/OpenAI key)
     - **Path**: "Talk" (for ChatGPT conversations)
     - **Optimization Level**: 2 (recommended) or higher for more savings
   - Click "Save Settings"

3. **Open ChatGPT**:
   - Go to https://chat.openai.com or https://chatgpt.com
   - Open browser console (F12 or Cmd+Option+I on Mac)

4. **Check extension status**:
   - In console, you should see: `[Spectyra] ChatGPT detected! Extension is ready.`
   - Type: `window.__spectyraTest()`
   - Check the output - it should show:
     - `settingsReady: true`
     - `isEnabled: true`
     - `settings` object with your API keys

5. **Test interception**:
   - Send a message in ChatGPT
   - Watch the console for:
     - `[Spectyra] Received intercept request from page script`
     - `[Spectyra] Intercepting request from page script`
     - `[Spectyra] Optimization successful`
   - You should see a savings widget appear in the top-right corner

## What to Look For

### ✅ Success Indicators:
- Console shows "Page script injected for fetch interception"
- Console shows "Received intercept request" when you send a message
- Console shows "Optimization successful" with savings data
- Savings widget appears showing tokens saved and cost saved
- Popup shows increasing "Calls Optimized" count

### ❌ Troubleshooting:

**No interception happening:**
- Check console for errors
- Verify `window.__spectyraTest()` shows `isEnabled: true`
- Make sure both API keys are set
- Try reloading the page after configuring settings

**"Extension not enabled" message:**
- Go to Settings and check the "Enable Spectyra" checkbox
- Verify both API keys are entered

**"Settings missing" message:**
- Reload the extension
- Re-enter settings and save
- Check console for storage errors

**Timeout errors:**
- Check that Spectyra API URL is correct
- Verify your Spectyra API key is valid
- Check network tab to see if API calls are being made

**Requests still going to OpenAI directly:**
- Check console logs to see why interception was skipped
- Verify the page script was injected (look for "Page script injected" message)
- Make sure you're on chat.openai.com or chatgpt.com

## ChatGPT-Specific Notes

- ChatGPT uses `api.openai.com` for API calls - this is already detected
- ChatGPT may use streaming responses - the extension handles this
- ChatGPT's UI may cache responses - you might need to refresh to see changes
- The extension intercepts at the fetch level, so it works regardless of ChatGPT's UI implementation

## Expected Console Output

When working correctly, you should see:

```
[Spectyra] Content script loaded on LLM site {hostname: "chat.openai.com", ...}
[Spectyra] Page script injected for fetch interception
[Spectyra] ChatGPT detected! Extension is ready.
[Spectyra] Content script initialized {isEnabled: true, ...}
[Spectyra] Received intercept request from page script {requestId: "...", url: "https://api.openai.com/...", ...}
[Spectyra] Intercepting request from page script {provider: "openai", model: "gpt-4", ...}
[Spectyra] Calling API: {url: "...", provider: "openai", ...}
[Spectyra] Optimization successful {hasSavings: true, tokensSaved: 1234, ...}
[Spectyra] Sending savings update to background: {tokensSaved: 1234, costSavedUsd: 0.0123}
```

## Getting Help

If you're still having issues:
1. Copy all console logs (both `[Spectyra]` and any errors)
2. Check the extension popup - what does it show?
3. Try the test function: `window.__spectyraTest()`
4. Check the background script console (chrome://extensions → Service Worker)
