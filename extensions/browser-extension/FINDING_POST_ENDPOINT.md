# Finding ChatGPT's POST Endpoint

## Method 1: Using Enhanced Console Logs (Easiest)

The extension now logs all POST requests to ChatGPT's backend. Here's how to find it:

1. **Reload the extension** (chrome://extensions → Reload)
2. **Reload ChatGPT page** (F5 or Cmd+R)
3. **Open Console** (F12 or Cmd+Option+I → Console tab)
4. **Send a message** in ChatGPT
5. **Look for** the red log message: `🔍 POTENTIAL LLM POST REQUEST`
6. **Copy the full URL** from that log

The log will show:
- Full URL
- Method (should be POST)
- Request body structure
- Endpoint path

## Method 2: Using Browser Network Tab

1. **Open DevTools** (F12 or Cmd+Option+I)
2. **Go to Network tab**
3. **Filter by**: `backend-api` or `chatgpt.com`
4. **Send a message** in ChatGPT
5. **Look for POST requests** (not GET)
6. **Click on the POST request**
7. **Copy the Request URL** from the Headers tab

Common patterns to look for:
- `/backend-api/conversation`
- `/backend-api/f/conversation`
- `/backend-api/chat`
- `/backend-api/message`

## Method 3: Using Extension Test Functions

1. **Open ChatGPT page**
2. **Open Console** (F12)
3. **Send a message** in ChatGPT
4. **Run in console**:
   ```javascript
   await window.__spectyraPageTest()
   ```
5. **Check `interceptedRequests`** array for POST requests
6. **Or run**:
   ```javascript
   window.__spectyraGetChatGPTPosts()
   ```
   This will show all intercepted ChatGPT POST requests

## What to Look For

The POST endpoint should:
- ✅ Be a POST request (not GET)
- ✅ Have a request body (not empty)
- ✅ Be to `chatgpt.com/backend-api/` or `chat.openai.com/backend-api/`
- ✅ Contain message/conversation data in the body
- ✅ Not be `/prepare` (that's GET)

## What to Share

When you find it, share:
1. **Full URL** (e.g., `https://chatgpt.com/backend-api/f/conversation`)
2. **Request body structure** (from the console log or Network tab)
3. **Response format** (from Network tab → Response tab)

This will help me adjust the format handling!
