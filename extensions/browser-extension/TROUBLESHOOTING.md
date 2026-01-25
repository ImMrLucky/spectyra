# Troubleshooting Guide

## Issue: Savings showing as 0

If you're seeing zeros for all savings metrics, follow these steps:

### Step 1: Verify Extension is Loaded
1. Open browser console (F12 or Cmd+Option+I)
2. Look for `[Spectyra]` log messages
3. Type `window.__spectyraTest()` in console to see extension status

### Step 2: Check Settings
1. Click the extension icon
2. Click "Settings"
3. Verify:
   - ✅ Extension is enabled (checkbox checked)
   - ✅ Spectyra API URL is set (e.g., `https://spectyra.up.railway.app/v1`)
   - ✅ Spectyra API Key is entered
   - ✅ Provider API Key is entered (your OpenAI/Anthropic/etc key)
   - ✅ Optimization Level is set (0-4)
   - ✅ Path is selected (talk or code)

### Step 3: Check if Requests are Being Intercepted
1. Open browser console
2. Make a request to an LLM provider (e.g., use ChatGPT)
3. Look for `[Spectyra] Detected provider request` messages
4. Look for `[Spectyra] Intercepting chat request` messages

### Step 4: Check API Response
1. In console, look for `[Spectyra] Optimization successful` messages
2. Check if `hasSavings: true` in the log
3. Check if `tokensSaved` and `costSavedUsd` have values

### Step 5: Check Background Script
1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Find Spectyra extension
3. Click "Service Worker" or "Inspect views: background page"
4. Look for `[Spectyra Background]` log messages
5. Check for `Session savings updated` messages

### Step 6: Reload Extension
1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Find Spectyra extension
3. Click the reload icon (circular arrow)
4. Refresh the page where you're using the LLM

### Common Issues

#### Issue: No requests being intercepted
**Possible causes:**
- Site uses XMLHttpRequest instead of fetch (not supported yet)
- Site uses WebSockets (not supported yet)
- Extension not enabled in settings
- API keys not configured

**Solution:**
- Verify extension is enabled
- Check that you're using a supported site (ChatGPT, Claude, etc.)
- Check console for error messages

#### Issue: Requests intercepted but no savings
**Possible causes:**
- API not returning savings in response
- Savings values are 0 (no optimization benefit)
- Response structure doesn't match expected format

**Solution:**
- Check console logs for API response structure
- Verify API is returning `savings` object
- Try a longer conversation (more context = more savings)

#### Issue: Savings not updating in popup
**Possible causes:**
- Background script not receiving messages
- Storage not persisting
- Popup not refreshing

**Solution:**
- Close and reopen popup
- Check background script console for errors
- Try resetting session and making new requests

### Debug Mode

Debug mode is currently enabled. To disable it:
1. Open `content.js`
2. Change `DEBUG: true` to `DEBUG: false`
3. Reload extension

### Testing

To test if extension is working:
1. Open browser console
2. Type `window.__spectyraTest()`
3. Check the output for extension status
4. Make a request to an LLM provider
5. Check console for interception logs

### Getting Help

If issues persist:
1. Collect console logs (both content script and background script)
2. Note which LLM provider you're using
3. Note which website you're on
4. Check if extension version matches expected version (1.0.0)
