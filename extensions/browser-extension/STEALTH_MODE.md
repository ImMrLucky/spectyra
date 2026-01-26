# Stealth Mode Implementation

## Overview

The extension now includes **full stealth mode** to minimize detection by LLM providers like ChatGPT.

## Stealth Features

### ✅ Enabled by Default (DEBUG = false)

1. **No Console Logs**
   - All `console.log()` calls are disabled in production
   - Only errors are logged (necessary for debugging)
   - ChatGPT cannot see extension activity in console

2. **Hidden Window Properties**
   - Uses `__sp_inj` instead of `__spectyraInjected` (less obvious)
   - Test functions only exposed in DEBUG mode
   - Minimal footprint in page context

3. **Obfuscated Message Types**
   - Uses `__sp_int`, `__sp_res`, `__sp_png` instead of `SPECTYRA_*`
   - Less obvious if ChatGPT checks `window.postMessage` listeners
   - Still functional, just less detectable

4. **Fetch Override Preservation**
   - Tries to preserve original fetch signature
   - Less detectable if ChatGPT checks `window.fetch.toString()`

## What's Still Detectable

⚠️ **Fetch Override**: ChatGPT can still detect that `window.fetch` is modified
- **Risk**: Medium
- **Mitigation**: Can't be fully hidden (required for functionality)
- **Impact**: They know an extension exists, but not what it does

⚠️ **Response Format**: If our response doesn't match exactly
- **Risk**: High
- **Mitigation**: Must match ChatGPT's format precisely
- **Impact**: Could break functionality or be detected

## Detection Risk Levels

| Feature | Risk | Mitigated? |
|---------|------|------------|
| Console logs | Low | ✅ Yes (DEBUG=false) |
| Window properties | Low | ✅ Yes (obfuscated) |
| Message types | Low | ✅ Yes (obfuscated) |
| Fetch override | Medium | ⚠️ Partial (required) |
| Response format | High | ⚠️ Must match exactly |
| API keys | None | ✅ Never exposed |

## Recommendations

1. **Keep DEBUG = false** in production
2. **Test response format** matches ChatGPT exactly
3. **Monitor for issues** - if ChatGPT changes API, extension may break
4. **Use test accounts** if possible
5. **Understand risks** - detection is still possible

## Enabling Debug Mode

To enable debug mode for troubleshooting:
1. Set `CONFIG.DEBUG = true` in `content.js`
2. Reload extension
3. Console logs will appear
4. **Remember to disable before production!**
