# Privacy and Detection Analysis

## What ChatGPT CAN See

### 1. Console Logs (if they check)
- **Risk**: Medium
- **What**: All `console.log()` calls in `inject.js` are visible in the page's console
- **Detection**: ChatGPT's JavaScript could read console logs if they check
- **Mitigation**: Disable logs in production mode

### 2. Window Properties
- **Risk**: Low-Medium
- **What**: `window.__spectyraInjected`, `window.__spectyraPageTest`, etc.
- **Detection**: ChatGPT could check `window.__spectyraInjected === true`
- **Mitigation**: Use less obvious property names or remove entirely in production

### 3. Fetch Override
- **Risk**: Medium
- **What**: `window.fetch` is overridden
- **Detection**: ChatGPT could check `window.fetch.toString()` to see if it's been modified
- **Mitigation**: Make the override look more like the original fetch

### 4. PostMessage Events
- **Risk**: Low
- **What**: `window.postMessage()` calls with `SPECTYRA_*` types
- **Detection**: ChatGPT could listen to `window.addEventListener('message')`
- **Mitigation**: Use less obvious message types or encrypt payloads

### 5. Response Format Differences
- **Risk**: High
- **What**: If our transformed response doesn't match ChatGPT's expected format exactly
- **Detection**: ChatGPT could detect anomalies in response structure
- **Mitigation**: Match response format exactly, including all fields

### 6. Timing Differences
- **Risk**: Low
- **What**: Requests may take slightly longer (Spectyra processing + network)
- **Detection**: Unlikely, but possible if they track response times
- **Mitigation**: Minimize processing time, use caching

## What ChatGPT CANNOT See

### ✅ API Keys
- **Spectyra API Key**: Only sent to Spectyra backend, never to ChatGPT
- **Provider API Key**: Only sent to Spectyra backend, never to ChatGPT
- **Location**: Headers in requests to `spectyra.up.railway.app`, not ChatGPT

### ✅ Spectyra Backend Calls
- **Requests to Spectyra**: Happen in content script context (isolated world)
- **Network Tab**: User can see them, but ChatGPT's page JavaScript cannot
- **Privacy**: ChatGPT has no access to content script context

### ✅ Extension Settings
- **Storage**: Stored in `chrome.storage`, not accessible to page
- **Settings**: Only accessible to extension, not ChatGPT's page

### ✅ User Data
- **Conversations**: Only sent to Spectyra for optimization, not stored
- **Messages**: Processed but not logged by extension (unless DEBUG mode)

## Detection Risk Assessment

| Method | Risk Level | Likelihood | Impact |
|--------|-----------|------------|--------|
| Console logs | Medium | High | Low (just knows extension exists) |
| Window properties | Low | Medium | Low |
| Fetch override | Medium | Medium | Medium (could block) |
| PostMessage | Low | Low | Low |
| Response format | High | Medium | High (could break functionality) |
| Timing | Low | Low | Low |

## Recommendations

### For Production (Stealth Mode)

1. **Disable Console Logs**
   - Set `CONFIG.DEBUG = false` in `content.js`
   - Remove or conditionally disable logs in `inject.js`

2. **Remove Window Properties**
   - Don't set `window.__spectyraInjected` (or use a less obvious name)
   - Remove test functions or make them less obvious

3. **Match Response Format Exactly**
   - Ensure transformed responses match ChatGPT's expected format 100%
   - Include all fields, same structure, same types

4. **Minimize Detection Surface**
   - Use less obvious message types
   - Make fetch override look more like original

5. **Add Stealth Mode Setting**
   - Let users enable/disable stealth mode
   - When enabled, minimize all detectable artifacts

## Current Status

- ✅ **API Keys**: Protected (never sent to ChatGPT)
- ✅ **Backend Calls**: Private (content script context)
- ⚠️ **Console Logs**: Visible (can be disabled)
- ⚠️ **Window Properties**: Detectable (can be removed)
- ⚠️ **Response Format**: Needs exact matching

## Legal/Policy Considerations

- **Terms of Service**: Check ChatGPT's ToS regarding browser extensions
- **Rate Limiting**: Using Spectyra may affect rate limits differently
- **Data Privacy**: Messages are sent to Spectyra backend (check Spectyra's privacy policy)
