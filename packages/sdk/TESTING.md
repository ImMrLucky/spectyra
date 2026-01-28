# Testing @spectyra/sdk Integration

This guide helps you test the published SDK to ensure all integrations work correctly.

## Prerequisites

1. **Published SDK**: `@spectyra/sdk` should be published to npm
2. **Node.js**: Version 18+ (for `fetch` support)
3. **API Endpoint**: Your Spectyra API should be running (for API mode tests)
4. **API Key**: A valid Spectyra API key (for API mode tests)
5. **SDK Access**: Your organization must have SDK access enabled (contact support if you get 403 errors)
6. **Anthropic API Key**: For testing with Claude Agent SDK (optional)

## Quick Test: Verify Installation

```bash
# Create a test directory
mkdir test-spectyra-sdk
cd test-spectyra-sdk

# Initialize npm project
npm init -y

# Install the SDK
npm install @spectyra/sdk

# Verify installation
node -e "import('@spectyra/sdk').then(m => console.log('✅ SDK installed:', Object.keys(m)))"
```

Expected output:
```
✅ SDK installed: [ 'createSpectyra', 'SpectyraClient' ]
```

## Test 1: Local Mode (No API Required)

Create `test-local.js`:

```javascript
import { createSpectyra } from '@spectyra/sdk';

// Test local mode
const spectyra = createSpectyra({ mode: "local" });

// Create context
const ctx = {
  runId: crypto.randomUUID(),
  budgetUsd: 2.5,
  tags: { project: "test" },
};

// Test with string prompt
const prompt1 = "Fix the bug in src/utils.ts";
const options1 = spectyra.agentOptions(ctx, prompt1);
console.log('✅ Local mode (string prompt):', options1);

// Test with PromptMeta
const promptMeta = {
  promptChars: 5000,
  path: "code",
  repoId: "test-repo",
  language: "typescript",
};
const options2 = spectyra.agentOptions(ctx, promptMeta);
console.log('✅ Local mode (PromptMeta):', options2);

// Verify options structure
const required = ['model', 'maxBudgetUsd', 'allowedTools', 'permissionMode'];
const hasAll = required.every(key => key in options1);
console.log(hasAll ? '✅ Options structure valid' : '❌ Missing required fields');
```

Run:
```bash
node test-local.js
```

**Expected Results:**
- ✅ Options returned with `model`, `maxBudgetUsd`, `allowedTools`, `permissionMode`
- ✅ Model selection based on prompt length (haiku for <6k, sonnet for <20k, etc.)
- ✅ Budget set to $2.5 (from ctx)

## Test 2: API Mode (Requires Running API)

Create `test-api.js`:

```javascript
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({
  mode: "api",
  endpoint: process.env.SPECTYRA_ENDPOINT || "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY,
});

if (!process.env.SPECTYRA_API_KEY) {
  console.error('❌ SPECTYRA_API_KEY environment variable required');
  process.exit(1);
}

async function test() {
  const ctx = {
    runId: crypto.randomUUID(),
    budgetUsd: 5.0,
  };

  const promptMeta = {
    promptChars: 10000,
    path: "code",
    repoId: "test-repo",
    language: "typescript",
  };

  try {
    // Test agentOptionsRemote
    console.log('Testing agentOptionsRemote...');
    const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
    console.log('✅ agentOptionsRemote:', response);
    
    // Verify response structure
    if (response.run_id && response.options && response.reasons) {
      console.log('✅ Response structure valid');
    } else {
      console.log('❌ Invalid response structure');
    }

    // Test sendAgentEvent
    console.log('Testing sendAgentEvent...');
    await spectyra.sendAgentEvent(ctx, {
      type: "test_event",
      timestamp: new Date().toISOString(),
      data: { test: true },
    });
    console.log('✅ Event sent successfully');

  } catch (error) {
    // Handle SDK access disabled error
    if (error.status === 403 || error.message?.includes('SDK access is disabled')) {
      console.error('⚠️  SDK access is disabled for this organization');
      console.error('   Please contact support to enable SDK access');
      console.error('   Error details:', error.message);
      process.exit(1);
    }
    console.error('❌ API mode test failed:', error.message);
    process.exit(1);
  }
}

test();
```

Run:
```bash
export SPECTYRA_API_KEY="your-api-key"
export SPECTYRA_ENDPOINT="https://spectyra.up.railway.app/v1"  # Optional
node test-api.js
```

**Expected Results:**
- ✅ `agentOptionsRemote` returns options with `run_id`, `options`, `reasons`
- ✅ `sendAgentEvent` completes without errors
- ✅ `ctx.runId` is updated if not set

**Note:** If you receive a 403 error with message "SDK access is disabled for this organization", your organization's SDK access has been disabled by an administrator. Contact support to enable SDK access.

## Test 3: Full Integration with Claude Agent SDK

Create `test-claude-integration.js`:

```javascript
import { createSpectyra } from '@spectyra/sdk';
// Note: You'll need to install @anthropic-ai/sdk separately
// npm install @anthropic-ai/sdk

// This test requires Claude Agent SDK
// Uncomment and install dependencies to run:

/*
import { Agent } from '@anthropic-ai/sdk/agent';

const spectyra = createSpectyra({ mode: "local" });

const ctx = {
  runId: crypto.randomUUID(),
  budgetUsd: 2.5,
};

const prompt = "Write a hello world function in TypeScript";

// Get options from Spectyra
const options = spectyra.agentOptions(ctx, prompt);
console.log('Spectyra options:', options);

// Use with Claude Agent SDK
const agent = new Agent({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...options,
});

// Test query
const result = await agent.query({ prompt });
console.log('✅ Claude Agent integration successful');
console.log('Result:', result);
*/
```

## Test 4: Event Streaming

Create `test-streaming.js`:

```javascript
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({
  mode: "api",
  endpoint: process.env.SPECTYRA_ENDPOINT || "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY,
});

async function* mockAgentStream() {
  yield { type: "start", timestamp: new Date().toISOString() };
  yield { type: "tool_call", tool: "Read", input: { path: "test.ts" } };
  yield { type: "tool_result", result: "file content" };
  yield { type: "complete", timestamp: new Date().toISOString() };
}

async function test() {
  const ctx = {
    runId: crypto.randomUUID(),
  };

  try {
    console.log('Testing observeAgentStream...');
    await spectyra.observeAgentStream(ctx, mockAgentStream());
    console.log('✅ Stream observation successful');
  } catch (error) {
    console.error('❌ Streaming test failed:', error.message);
  }
}

test();
```

## Test 5: Error Handling

Create `test-errors.js`:

```javascript
import { createSpectyra } from '@spectyra/sdk';

// Test 1: Missing endpoint in API mode
try {
  createSpectyra({ mode: "api", apiKey: "test" });
  console.log('❌ Should have thrown error for missing endpoint');
} catch (error) {
  console.log('✅ Correctly throws error for missing endpoint:', error.message);
}

// Test 2: Missing API key in API mode
try {
  createSpectyra({ mode: "api", endpoint: "https://test.com" });
  console.log('❌ Should have thrown error for missing apiKey');
} catch (error) {
  console.log('✅ Correctly throws error for missing apiKey:', error.message);
}

// Test 3: Invalid API mode call
const local = createSpectyra({ mode: "local" });
try {
  await local.agentOptionsRemote({}, { promptChars: 100 });
  console.log('❌ Should have thrown error for API mode requirement');
} catch (error) {
  console.log('✅ Correctly throws error for API mode requirement:', error.message);
}

// Test 4: SDK Access Disabled (403 error)
const spectyra = createSpectyra({
  mode: "api",
  endpoint: process.env.SPECTYRA_ENDPOINT || "https://spectyra.up.railway.app/v1",
  apiKey: process.env.SPECTYRA_API_KEY,
});

try {
  const response = await spectyra.agentOptionsRemote(
    { runId: "test" },
    { promptChars: 1000, path: "code" }
  );
  console.log('✅ SDK access enabled');
} catch (error) {
  if (error.status === 403 || error.message?.includes('SDK access is disabled')) {
    console.log('⚠️  SDK access is disabled for this organization');
    console.log('   Error:', error.message);
    console.log('   Action: Contact support to enable SDK access');
  } else {
    console.log('❌ Unexpected error:', error.message);
  }
}
```

## Test 6: Legacy Client (Backwards Compatibility)

Create `test-legacy.js`:

```javascript
import { SpectyraClient } from '@spectyra/sdk';

// Test legacy client instantiation
const client = new SpectyraClient({
  apiUrl: process.env.SPECTYRA_ENDPOINT || "https://spectyra.up.railway.app/v1",
  spectyraKey: process.env.SPECTYRA_API_KEY,
  provider: "openai",
  providerKey: process.env.OPENAI_API_KEY || "test-key",
});

console.log('✅ Legacy client instantiated');

// Note: Full chat test requires valid provider keys
// Uncomment to test:
/*
const response = await client.chat({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello" }],
  path: "talk",
  optimization_level: 2,
});
console.log('✅ Legacy client chat successful');
*/
```

## Complete Test Suite

Create `test-all.js` to run all tests:

```javascript
import { createSpectyra } from '@spectyra/sdk';

const tests = [];

// Test 1: Local mode
tests.push({
  name: "Local Mode",
  run: () => {
    const spectyra = createSpectyra({ mode: "local" });
    const options = spectyra.agentOptions({ runId: "test" }, "test prompt");
    return options.model && options.maxBudgetUsd;
  },
});

// Test 2: API mode validation
tests.push({
  name: "API Mode Validation",
  run: () => {
    try {
      createSpectyra({ mode: "api" });
      return false; // Should throw
    } catch {
      return true; // Correctly throws
    }
  },
});

// Test 3: Exports
tests.push({
  name: "Exports",
  run: async () => {
    const sdk = await import('@spectyra/sdk');
    return 'createSpectyra' in sdk && 'SpectyraClient' in sdk;
  },
});

// Run all tests
async function runTests() {
  console.log('Running SDK tests...\n');
  
  for (const test of tests) {
    try {
      const result = await test.run();
      console.log(result ? `✅ ${test.name}` : `❌ ${test.name}`);
    } catch (error) {
      console.log(`❌ ${test.name}: ${error.message}`);
    }
  }
}

runTests();
```

## Integration Checklist

- [ ] SDK installs correctly: `npm install @spectyra/sdk`
- [ ] Local mode works without API
- [ ] API mode validates configuration
- [ ] `agentOptions()` returns valid options
- [ ] `agentOptionsRemote()` calls API successfully
- [ ] `sendAgentEvent()` sends events
- [ ] `observeAgentStream()` processes streams
- [ ] Error handling works correctly
- [ ] Legacy `SpectyraClient` still works
- [ ] TypeScript types are available

## Troubleshooting

### "Cannot find module '@spectyra/sdk'"
- Verify package is published: `npm view @spectyra/sdk`
- Clear npm cache: `npm cache clean --force`
- Reinstall: `rm -rf node_modules package-lock.json && npm install`

### "fetch is not defined"
- Ensure Node.js 18+ (has native `fetch`)
- Or install `node-fetch` and polyfill

### API mode errors
- Verify API endpoint is accessible
- Check API key is valid
- Ensure API server is running

### "SDK access is disabled for this organization" (403 error)
- **Cause**: Your organization's SDK access has been disabled by an administrator
- **Solution**: Contact support (or the organization owner) to enable SDK access
- **Note**: Chat optimization endpoints (`/v1/chat`) are not affected by SDK access control
- **What still works**: 
  - Local mode (no API required)
  - Chat optimization endpoints
  - Authentication endpoints

### TypeScript errors
- Install types: `npm install --save-dev @types/node`
- Verify `tsconfig.json` includes proper lib settings

## SDK Access Control

### Understanding SDK Access

Spectyra implements SDK access control to manage which organizations can use the SDK endpoints. This is controlled by an administrator and can be enabled/disabled per organization.

### What's Affected

**SDK Endpoints (require SDK access):**
- `POST /v1/agent/options` - Get agent options
- `POST /v1/agent/events` - Send agent events

**Not Affected (always accessible):**
- `POST /v1/chat` - Chat optimization (not SDK)
- `GET /v1/auth/*` - Authentication endpoints
- `GET /v1/billing/*` - Billing endpoints

### Error Response

When SDK access is disabled, you'll receive a 403 error:

```json
{
  "error": "SDK access is disabled for this organization",
  "message": "Please contact support to enable SDK access"
}
```

### Handling SDK Access Errors

```javascript
import { createSpectyra } from '@spectyra/sdk';

const spectyra = createSpectyra({
  mode: "api",
  endpoint: process.env.SPECTYRA_ENDPOINT,
  apiKey: process.env.SPECTYRA_API_KEY,
});

try {
  const response = await spectyra.agentOptionsRemote(ctx, promptMeta);
  // Success - SDK access is enabled
} catch (error) {
  if (error.status === 403 && error.message?.includes('SDK access is disabled')) {
    // SDK access is disabled
    console.error('SDK access is disabled. Please contact support.');
    // Fallback to local mode or show user-friendly message
  } else {
    // Other error (network, invalid key, etc.)
    console.error('API error:', error.message);
  }
}
```

### Default State

- **New organizations**: SDK access is **enabled by default**
- **Existing organizations**: SDK access remains enabled unless explicitly disabled
- **Local mode**: Not affected by SDK access control (works offline)

## Next Steps

1. Test in a real project
2. Integrate with Claude Agent SDK
3. Test with your actual API endpoint
4. Monitor telemetry in your dashboard
5. Verify events appear in Runs page
6. Handle SDK access errors gracefully in your application
