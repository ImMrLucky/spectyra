# Web UI Support Status

## Overview

The extension now supports intercepting requests from web UIs (ChatGPT, Claude, Gemini, Grok) in addition to direct provider API calls.

## Supported Interfaces

### ✅ Direct Provider APIs (Fully Working)
- `api.openai.com/v1/chat/completions`
- `api.anthropic.com/v1/messages`
- `generativelanguage.googleapis.com/v1/...`
- `api.x.ai/v1/...`

**Status**: ✅ Fully functional, tested, production-ready

### ⚠️ Web UI Backends (In Progress)

#### ChatGPT (`chatgpt.com`, `chat.openai.com`)
- **Detection**: ✅ Detects `/backend-api/` endpoints
- **Request Parsing**: ⚠️ Multiple format patterns attempted
- **Response Format**: ⚠️ Basic format implemented (may need adjustment)
- **Status**: 🟡 Partially working - needs testing with actual requests

**Known Issues**:
- ChatGPT uses streaming responses - we return complete response (may need streaming support)
- Exact request/response format may vary - needs real-world testing
- `/prepare` endpoint is GET (not intercepted) - need to find actual POST endpoint

#### Claude (`claude.ai`)
- **Detection**: ✅ Detects Claude backend API
- **Request Parsing**: ⚠️ Basic format support
- **Response Format**: ⚠️ Basic format implemented
- **Status**: 🟡 Implemented but untested

#### Gemini (`gemini.google.com`, `gemini.app`)
- **Detection**: ✅ Detects Gemini backend API
- **Request Parsing**: ⚠️ Basic format support
- **Response Format**: ⚠️ Basic format implemented
- **Status**: 🟡 Implemented but untested

#### Grok (`x.ai`)
- **Detection**: ✅ Detects Grok backend API (excludes `api.x.ai`)
- **Request Parsing**: ⚠️ Basic format support
- **Response Format**: ⚠️ Basic format implemented
- **Status**: 🟡 Implemented but untested

## Code Path Auto-Detection

The extension now automatically detects coding workflows by looking for:
- Code blocks (```)
- Programming keywords (function, class, def, import, const, let, var)
- Coding-related terms (bug, fix, refactor, implement)

When code is detected, it uses the `code` path for better optimization.

## Testing Checklist

### ChatGPT
- [ ] Find actual POST endpoint (not GET `/prepare`)
- [ ] Test request format parsing
- [ ] Test response format transformation
- [ ] Test with real conversations
- [ ] Test with coding workflows
- [ ] Handle streaming if needed

### Claude
- [ ] Test detection works
- [ ] Test request/response format
- [ ] Test with real conversations

### Gemini
- [ ] Test detection works
- [ ] Test request/response format
- [ ] Test with real conversations

### Grok
- [ ] Test detection works
- [ ] Test request/response format
- [ ] Test with real conversations

## Next Steps

1. **Find ChatGPT's actual POST endpoint** - The `/prepare` is GET, we need the POST that sends messages
2. **Test with real requests** - See what format ChatGPT actually uses
3. **Adjust format transformation** - Match exact ChatGPT format
4. **Test other web UIs** - Verify Claude, Gemini, Grok work
5. **Handle streaming** - If web UIs use streaming, we may need to support that

## Debugging

To debug web UI interception:
1. Open page console (right-click → Inspect)
2. Send a message in the web UI
3. Look for `[Spectyra Page] Fetch called:` logs
4. Find the POST request (not GET)
5. Check if it's being intercepted
6. Check request/response format in logs

## Known Limitations

1. **Streaming Responses**: Web UIs often use streaming - we return complete responses (may need enhancement)
2. **Format Changes**: Web UI formats may change without notice
3. **Authentication**: Web UIs may use different auth mechanisms
4. **Rate Limiting**: Web UIs may have different rate limiting
