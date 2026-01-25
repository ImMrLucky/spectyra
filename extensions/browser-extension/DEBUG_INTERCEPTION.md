# Debugging Interception Issues

## Quick Diagnostic Steps

### 1. Verify Page Script is Loaded

Open the **page console** (not the extension console):
- Right-click on the page → Inspect
- Go to Console tab
- Type: `window.__spectyraPageTest()`

**Expected output:**
```javascript
{
  injected: true,
  interceptCount: 0,  // Will increase when requests are intercepted
  fetchOverridden: true
}
```

**If you get an error:**
- Page script is not injected
- Try reloading the page
- Check for CSP errors in console

### 2. Check if Fetch is Being Called

In the **page console**, you should see:
```
[Spectyra Page] Fetch called: {url: "...", method: "POST", ...}
```

When you send a message in ChatGPT, you should see these logs.

### 3. Check Network Tab

1. Open DevTools → Network tab
2. Send a message in ChatGPT
3. Look for requests to:
   - `api.openai.com`
   - Any URL containing `/v1/chat/completions`
   - Any URL containing `/v1/messages`

**Note the exact URL** - ChatGPT might use a different endpoint than we're checking for.

### 4. Verify Message Passing

In the **extension console** (content script), you should see:
- `[Spectyra] Page script is active and communicating` (when page script loads)
- `[Spectyra] Received intercept request from page script` (when ChatGPT makes a request)

### 5. Common Issues

#### Issue: Page script not injected
**Symptoms:**
- `window.__spectyraPageTest()` returns undefined
- No `[Spectyra Page]` logs in page console

**Solutions:**
- Reload the page after configuring extension
- Check for CSP errors
- Verify `inject.js` is in `web_accessible_resources` in manifest

#### Issue: Fetch not being intercepted
**Symptoms:**
- Page script is loaded (`window.__spectyraPageTest()` works)
- But no `[Spectyra Page] Intercepting LLM request` logs

**Possible causes:**
- ChatGPT using different URL pattern
- ChatGPT using XMLHttpRequest instead of fetch
- ChatGPT using WebSockets

**Solutions:**
- Check Network tab for actual URLs being called
- Update URL detection in `inject.js` if needed

#### Issue: Interception happens but no savings
**Symptoms:**
- See interception logs
- But savings stay at 0

**Possible causes:**
- API call failing
- Response not being parsed correctly
- Savings not in response

**Solutions:**
- Check for API errors in console
- Verify API keys are correct
- Check Spectyra API is responding

## Manual Test

To manually test if interception works:

1. Open page console (not extension console)
2. Type:
```javascript
fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({model: 'gpt-4', messages: [{role: 'user', content: 'test'}]})
})
```

You should see:
- `[Spectyra Page] Intercepting LLM request #1`
- `[Spectyra] Received intercept request from page script`

If you don't see these, the page script isn't working.
