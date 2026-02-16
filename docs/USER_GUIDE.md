# Spectyra User Guide

## Getting Started

### 1. Create Your Account

1. Go to [Spectyra](https://your-spectyra-app.netlify.app)
2. Click "Sign Up"
3. Enter your email address
4. **Save your API key** - it's shown only once!
5. You'll get a 7-day free trial automatically

### 2. Choose Your Integration Method

Spectyra offers three ways to optimize your LLM usage:

---

## Integration Options

### Option A: Browser Extension (Recommended for Web Tools)

**Best for:**
- Using ChatGPT, Claude Web, or other web-based LLM tools
- Quick setup, no code changes
- Automatic optimization of all LLM calls

**How to Install:**

1. **Chrome/Edge:**
   - Install from Chrome Web Store or Edge Add-ons
   - Or load unpacked (development):
     - Go to `chrome://extensions/`
     - Enable "Developer mode"
     - Click "Load unpacked"
     - Select the `extensions/browser-extension` folder

2. **Configure:**
   - Click the Spectyra extension icon
   - Click "Settings"
   - Enter:
     - **Spectyra API URL**: `https://spectyra.up.railway.app/v1`
     - **Spectyra API Key**: Your API key from registration
     - **Provider API Key**: Your OpenAI/Anthropic/etc. key (BYOK)
     - **Path**: "Talk" for chat, "Code" for coding
     - **Optimization Level**: 0-4 (start with 2 for balanced)

3. **Use:**
   - Visit ChatGPT, Claude, or any LLM-powered site
   - Make requests normally
   - See real-time savings in the widget overlay
   - Check extension popup for session totals

**What It Does:**
- Automatically intercepts LLM API calls
- Routes them through Spectyra for optimization
- Shows savings without changing your workflow
- Works transparently in the background

---

### Option B: SDK + API (Recommended for Code Integration)

**Best for:**
- Building applications that use LLMs
- Integrating into existing codebases
- Full control over optimization settings
- Custom workflows

**Installation:**

```bash
npm install @spectyra/sdk
# or
pnpm add @spectyra/sdk
```

**Basic Usage:**

```typescript
import { SpectyraClient } from '@spectyra/sdk';

const client = new SpectyraClient({
  apiUrl: 'https://spectyra.up.railway.app/v1',
  spectyraKey: 'your-spectyra-api-key',
  providerKey: 'your-openai-key', // BYOK
});

// Chat request
const response = await client.chat({
  path: 'talk', // or 'code'
  provider: 'openai',
  model: 'gpt-4o-mini',
  optimizationLevel: 2,
  messages: [
    { role: 'user', content: 'Your question here' }
  ]
});

console.log(response.text);
console.log(`Saved ${response.savings?.pct_saved}% tokens`);
```

**For Coding Workflows:**

```typescript
// Code path with higher optimization
const codeResponse = await client.chat({
  path: 'code',
  provider: 'anthropic',
  model: 'claude-3-5-sonnet-20241022',
  optimizationLevel: 3, // Aggressive for code
  messages: [
    { role: 'user', content: 'Fix the bug in auth.js' },
    { role: 'assistant', content: 'Previous explanation...' },
    { role: 'user', content: 'Also handle null email case' }
  ]
});
```

**Advanced Features:**
- Dry-run mode for testing
- Custom optimization levels per request
- Access to savings metrics
- Quality guard integration

---

### Option C: Direct API Calls (For Custom Integrations)

**Best for:**
- Non-JavaScript environments
- Custom HTTP clients
- Maximum flexibility

**Example:**

```bash
curl -X POST https://spectyra.up.railway.app/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-SPECTYRA-KEY: your-spectyra-api-key" \
  -H "X-PROVIDER-KEY: your-openai-key" \
  -d '{
    "path": "code",
    "provider": "openai",
    "model": "gpt-4o-mini",
    "optimization_level": 2,
    "mode": "optimized",
    "messages": [
      {"role": "user", "content": "Your code question"}
    ]
  }'
```

---

## When to Use Each Method

### Use Browser Extension When:
- ✅ You use ChatGPT, Claude Web, or other web-based LLM tools
- ✅ You want zero code changes
- ✅ You want automatic optimization of all calls
- ✅ You're doing general chat/Q&A work
- ✅ You want to see savings in real-time on the page

### Use SDK + API When:
- ✅ You're building an application
- ✅ You need programmatic control
- ✅ You're doing coding workflows (bug fixes, refactoring)
- ✅ You want to integrate into CI/CD pipelines
- ✅ You need custom optimization per request
- ✅ You're using LLMs in backend services

### Use Direct API When:
- ✅ You're not using JavaScript/TypeScript
- ✅ You have a custom HTTP client
- ✅ You need maximum control over requests

---

## Coding Workflows: Browser Extension vs SDK

### Decision Guide

**Use Browser Extension for Coding When:**
- ✅ You're using ChatGPT/Claude web interface for code help
- ✅ Quick code questions and learning
- ✅ Exploring code solutions in browser
- ✅ You want zero setup, just works

**Use SDK + API for Coding When:**
- ✅ Building applications that use LLMs
- ✅ Integrating into development tools (IDEs, CLIs)
- ✅ Serious coding workflows (bug fixes, refactoring, feature work)
- ✅ Need code-specific optimizations (AST-aware slicing, patch mode)
- ✅ Want programmatic control over optimization
- ✅ Integrating into CI/CD pipelines

### Why SDK is Better for Coding

**1. Code-Specific Features:**
- **AST-aware code slicing**: Extracts function/class signatures for better relevance
- **Patch mode**: Requests unified diffs + explanations (huge token savings)
- **Dependency edges**: Detects code relationships (patch → code blocks)
- **Better context detection**: Understands code structure, not just text

**2. Better Control:**
```typescript
// SDK: Explicit code path and optimization
await client.chat({
  path: 'code',              // Explicitly code path
  optimizationLevel: 3,      // Aggressive for code
  messages: codeMessages
});

// Browser Extension: May not detect code context as well
// Works, but less optimal for code-specific features
```

**3. Integration:**
- Works with your existing codebase
- Can be integrated into:
  - Code editor extensions
  - CLI tools
  - CI/CD pipelines
  - Backend services
  - Development workflows

**4. Debugging:**
- Easier to debug and tune
- Can test with dry-run mode
- Better error handling
- Access to detailed metrics

### Example: SDK for Coding Workflow

```typescript
import { SpectyraClient } from '@spectyra/sdk';

// In your code editor extension or CLI tool
const client = new SpectyraClient({
  apiUrl: process.env.SPECTYRA_API_URL,
  spectyraKey: process.env.SPECTYRA_API_KEY,
  providerKey: process.env.OPENAI_API_KEY, // BYOK
});

async function fixBug(codeContext, bugDescription) {
  const response = await client.chat({
    path: 'code', // Critical: use 'code' path
    provider: 'openai',
    model: 'gpt-4o-mini',
    optimizationLevel: 3, // Aggressive for code
    messages: [
      { role: 'user', content: `Fix this bug: ${bugDescription}` },
      { role: 'assistant', content: codeContext },
      { role: 'user', content: 'Also handle edge case where input is null' }
    ]
  });

  // Response will be optimized:
  // - Code sliced to relevant parts
  // - Patch mode: unified diff format
  // - Context compacted with REFs
  // - 40-60% token savings typical

  return response.text; // Optimized response
}
```

### Recommendation Summary

| Use Case | Recommended Method | Why |
|----------|-------------------|-----|
| **ChatGPT/Claude Web for code help** | Browser Extension | Quick, easy, works immediately |
| **Building apps with LLMs** | SDK + API | Full control, better features |
| **Serious coding work** | SDK + API | Code-specific optimizations |
| **CI/CD integration** | SDK + API | Programmatic control |
| **General chat/Q&A** | Browser Extension | Easiest setup |
| **Custom workflows** | SDK + API | Maximum flexibility |

---

## Optimization Levels Explained

### Level 0: Minimal
- **Use case**: Testing, debugging
- **Savings**: ~5-10%
- **Quality**: Highest (minimal changes)

### Level 1: Conservative
- **Use case**: Quality-critical scenarios
- **Savings**: ~15-25%
- **Quality**: Very high

### Level 2: Balanced (Recommended)
- **Use case**: General production use
- **Savings**: ~30-45%
- **Quality**: High

### Level 3: Aggressive
- **Use case**: High-volume, cost-sensitive
- **Savings**: ~45-60%
- **Quality**: Good (may need retries)

### Level 4: Maximum
- **Use case**: Maximum savings, accept some quality risk
- **Savings**: ~55-70%
- **Quality**: Moderate (more retries possible)

**Tip:** Start with Level 2, increase if quality remains good.

---

## Understanding Your Savings

### Verified Savings (Confidence: High)
- From replay/scenario runs
- Paired baseline + optimized measurements
- 100% confidence

### Estimated Savings (Confidence: Medium/Low)
- From optimized runs without baseline
- Baseline estimated from historical data
- Confidence based on:
  - Sample size (more samples = higher confidence)
  - Variance (lower variance = higher confidence)
  - Recency (recent samples = higher confidence)

**Confidence Bands:**
- **High** (≥85%): Very reliable estimates
- **Medium** (70-85%): Generally reliable
- **Low** (<70%): Use with caution, may vary

---

## Best Practices

### For Chat/Q&A (Talk Path)
1. Use browser extension for web tools
2. Use SDK for custom applications
3. Start with optimization level 2
4. Monitor quality, adjust level as needed

### For Coding (Code Path)
1. **Use SDK + API** (not browser extension)
2. Set `path: "code"` explicitly
3. Use optimization level 3 for maximum savings
4. Monitor for patch mode output (unified diffs)
5. Check quality guard results

### General Tips
- Save your API key securely (shown only once)
- Use BYOK (Bring Your Own Key) for provider keys
- Start with lower optimization levels, increase gradually
- Monitor savings dashboard for trends
- Export savings data for accounting/reporting

---

## Troubleshooting

### Browser Extension Not Working
- Check extension is enabled in popup
- Verify Spectyra API key is correct
- Ensure provider API key is valid
- Check browser console for errors

### SDK Errors
- Verify API URL is correct
- Check API key is valid
- Ensure provider key is set (for BYOK)
- Check network connectivity

### Low Savings
- Try higher optimization level
- Ensure you're using the right path (talk vs code)
- Check that conversation has reusable content
- Verify quality guard isn't triggering retries

### Quality Issues
- Lower optimization level
- Check quality guard results
- Review debug panel (if available)
- Consider using Level 1 for critical tasks

---

## Support

- **Documentation**: See `APPLICATION_DESCRIPTION.md` for technical details
- **API Docs**: Check API endpoint documentation
- **Issues**: Report bugs or request features via GitHub/issues
