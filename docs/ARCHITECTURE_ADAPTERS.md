# Adapter Architecture

Spectyra uses an adapter pattern to isolate all vendor/tool-specific logic from the optimization core. Every external integration — whether it's the OpenAI API, Anthropic's Messages API, a local companion, or an agent harness — terminates at an adapter boundary.

## Design rule

**The optimizer core never sees vendor-specific shapes.**

All external requests are translated into Spectyra's canonical model by an adapter before they reach the optimization engine. All responses are translated back by the same adapter before returning to the caller.

## What adapters do

- Normalize message formats (roles, content parts, tool calls)
- Normalize tool definitions and tool results
- Normalize provider/model metadata
- Normalize structured output hints
- Extract execution metadata (flow type, step index, tool support)
- Estimate token usage from external request shapes

## What adapters must NOT do

- Apply optimization transforms
- Make policy decisions
- Embed vendor-specific optimization heuristics
- Mutate core engine behavior directly

## Adapter interface

```typescript
interface SpectyraAdapter<TExternalRequest, TExternalResponse> {
  id: string;
  category: "provider" | "tool" | "companion" | "agent_harness";
  canHandle(input: unknown): boolean;
  toCanonicalRequest(input: TExternalRequest, context?: AdapterContext): CanonicalRequest;
  fromCanonicalResponse(canonical: CanonicalResponse, originalInput: TExternalRequest): TExternalResponse;
  extractExecutionMetadata?(input: TExternalRequest): Partial<CanonicalExecutionMetadata>;
  estimateExternalUsage?(input: TExternalRequest): Partial<UsageEstimate>;
}
```

## Built-in adapters

| Adapter | Package | Category |
|---------|---------|----------|
| `OpenAIAdapter` | `@spectyra/adapters` | provider |
| `AnthropicAdapter` | `@spectyra/adapters` | provider |
| `GroqAdapter` | `@spectyra/adapters` | provider |
| `OpenAICompatibleAdapter` | `@spectyra/adapters` | provider |
| `LocalCompanionAdapter` | `@spectyra/adapters` | companion |
| `AgentHarnessAdapter` | `@spectyra/adapters` | agent_harness |
| `GenericAdapter` | `@spectyra/adapters` | tool (fallback) |

## Adapter registry

The registry auto-resolves the best adapter for a given input:

```typescript
import { resolveAdapter, registerAdapter } from "@spectyra/adapters";

const adapter = resolveAdapter(externalRequest);
const canonical = adapter.toCanonicalRequest(externalRequest);
```

Custom adapters registered via `registerAdapter()` are checked first (LIFO), then built-ins, then the generic fallback.

## Fallback behavior

If no specific adapter matches:
- The generic adapter treats input as a plain message array
- Unsafe advanced transforms are disabled (`prioritizeCompression: false`)
- Observe mode and reporting still work if the structure is valid

## Dependency direction

```
adapters → canonical-model (allowed)
canonical-model → adapters (FORBIDDEN)
optimization-engine → adapters (FORBIDDEN)
feature-detection → adapters (FORBIDDEN)
```

This is enforced by architectural tests in `@spectyra/optimization-engine`.
