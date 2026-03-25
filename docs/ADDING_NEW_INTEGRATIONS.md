# Adding New Integrations

After the adapter architecture is in place, adding support for a new tool or provider follows a predictable process. It should NOT require rewriting the optimizer core, transforms, or security model.

## Steps to add a new provider

### 1. Create a new adapter

Create a new file in `packages/adapters/src/` that implements `SpectyraAdapter`:

```typescript
import type { SpectyraAdapter, CanonicalRequest, CanonicalResponse } from "@spectyra/canonical-model";

export class NewProviderAdapter implements SpectyraAdapter<NewProviderRequest, NewProviderResponse> {
  id = "new-provider";
  category = "provider" as const;

  canHandle(input: unknown): boolean {
    // Return true if input matches this provider's shape
  }

  toCanonicalRequest(input: NewProviderRequest): CanonicalRequest {
    // Map provider-specific fields to canonical form
  }

  fromCanonicalResponse(canonical: CanonicalResponse, original: NewProviderRequest): NewProviderResponse {
    // Map canonical response back to provider-specific form
  }
}
```

### 2. Map request/response structure

The adapter must handle:
- Message format (roles, content types)
- Tool definitions and tool results
- System prompt handling (inline vs separate field)
- Usage/token reporting format
- Streaming vs non-streaming (if applicable)

### 3. Register the adapter

Export from `packages/adapters/src/index.ts` and optionally register in the registry:

```typescript
import { registerAdapter } from "./registry.js";
registerAdapter(new NewProviderAdapter());
```

### 4. Add test fixtures

Create test cases that verify:
- External request → canonical request mapping
- Canonical response → external response mapping
- No optimization logic is embedded in the adapter
- The adapter passes the anti-coupling test

### 5. Add integration metadata

Add a card to `packages/core-types/src/integrations.ts` so the web UI can display the new integration.

### 6. Add docs

Update integration documentation with setup steps and quickstart code.

## What you should NOT need to do

- Rewrite the optimizer core
- Add `if (provider === "new-provider")` to transforms
- Fork behavior by vendor in the engine
- Modify the security model
- Rewrite feature detectors

## For OpenAI-compatible providers

If the new provider implements the OpenAI chat completions API (most do), use `OpenAICompatibleAdapter`:

```typescript
import { OpenAICompatibleAdapter } from "@spectyra/adapters";

export class MyProviderAdapter extends OpenAICompatibleAdapter {
  constructor() { super("my-provider"); this.id = "my-provider"; }
}
```

This reuses all OpenAI mapping logic with a different vendor tag.

## Architecture test enforcement

The anti-coupling test (`packages/optimization-engine/src/__tests__/anti-coupling.test.ts`) will catch violations:

- If the optimization engine imports adapter modules → **build fails**
- If the engine references vendor/tool names → **build fails**
- If feature detectors reference vendor names → **build fails**
- If the canonical model imports higher-level packages → **build fails**

## Package dependency direction

```
Allowed:
  adapters          → canonical-model
  feature-detection → canonical-model
  optimization-engine → canonical-model + feature-detection + learning
  sdk / companion   → adapters + feature-detection + optimization-engine

Forbidden:
  optimization-engine → adapters
  feature-detection   → adapters
  canonical-model     → anything above it
```
