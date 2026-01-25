# Fetch Interception Fix

## Problem
The browser extension wasn't intercepting chat requests because content scripts run in an **isolated world** - they can't override `window.fetch` that the page's JavaScript uses.

## Solution
We now inject a script into the **page context** (not the isolated content script context) that:
1. Overrides `window.fetch` in the page's JavaScript context
2. Detects LLM provider requests (OpenAI, Anthropic, Gemini, Grok)
3. Sends a message to the content script to handle the interception
4. Waits for the content script to process the request through Spectyra
5. Returns the optimized response or falls back to original fetch

## How It Works

### 1. Script Injection
- The content script injects a script tag into the page's `<head>` or `<html>`
- This script runs in the page context, not the isolated content script context
- It overrides `window.fetch` before page scripts can use it

### 2. Request Detection
- The injected script checks if a fetch request is to an LLM provider
- If it's a POST request to an LLM provider, it:
  - Generates a unique `requestId`
  - Posts a message to the content script with request details
  - Waits for a response (with timeout)

### 3. Content Script Processing
- The content script listens for `SPECTYRA_INTERCEPT` messages
- When received, it:
  - Loads settings (if not ready)
  - Validates the request
  - Calls Spectyra API
  - Transforms the response
  - Sends response back to page script
  - Updates savings tracking

### 4. Response Handling
- The page script receives the response
- If response exists, returns it as a Response object
- If no response (or timeout), falls back to original fetch

## Testing

1. **Reload the extension**:
   - Go to `chrome://extensions/`
   - Find "Spectyra - LLM Cost Optimizer"
   - Click the reload icon

2. **Check console logs**:
   - Open browser console (F12)
   - Look for `[Spectyra] Page script injected for fetch interception`
   - Make a request to an LLM provider
   - Look for `[Spectyra] Received intercept request from page script`

3. **Verify interception**:
   - You should see logs showing:
     - Provider detection
     - Request parsing
     - Spectyra API call
     - Response transformation
     - Savings update

## Troubleshooting

### No interception happening
- Check console for `Page script injected` message
- Verify extension is enabled in settings
- Check that API keys are configured
- Look for error messages in console

### Timeout errors
- Check network tab to see if Spectyra API is responding
- Verify API URL is correct
- Check API keys are valid

### Requests still going to original provider
- Check console logs to see why interception was skipped
- Verify settings are loaded (`settingsReady` should be true)
- Check that `isEnabled` is true

## Files Changed

- `content.js`: Added page script injection and message listener
- `inject.js`: Created separate inject script (optional, fallback uses inline)
- `manifest.json`: Added `inject.js` to web_accessible_resources (if using separate file)

## Notes

- The page script injection happens at `document_start` to ensure it runs before page scripts
- If DOM isn't ready, we use a MutationObserver to wait
- The timeout is set to 10 seconds - if content script doesn't respond, original fetch is used
- This approach works for sites using `fetch()` but not `XMLHttpRequest` or WebSockets
