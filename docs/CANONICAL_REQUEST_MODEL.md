# Canonical Request Model

All optimization logic in Spectyra operates on a single canonical internal model. External formats (OpenAI, Anthropic, etc.) are adapted into this form before optimization and adapted back afterward.

## Package

`@spectyra/canonical-model`

## Why canonical

- The optimizer core stays vendor-agnostic
- Adding a new provider only requires a new adapter, not core changes
- Feature detectors operate on structure, not vendor names
- Transforms compose cleanly regardless of origin format

## Core types

### CanonicalRequest

The central input to the optimization engine:

| Field | Type | Description |
|-------|------|-------------|
| `requestId` | string | Unique ID for this request |
| `runId` | string | Run-level correlation ID |
| `mode` | `"off" \| "observe" \| "on"` | Optimization mode |
| `integrationType` | IntegrationType | SDK, companion, agent harness, etc. |
| `provider` | CanonicalProviderHint? | Vendor, model, API style |
| `messages` | CanonicalMessage[] | The conversation |
| `tools` | CanonicalToolDefinition[]? | Available tools |
| `toolResults` | CanonicalToolResult[]? | Tool call outputs |
| `context` | CanonicalContextBundle[]? | Attached context |
| `execution` | CanonicalExecutionMetadata | App/workflow metadata |
| `policies` | CanonicalPolicyHints? | Output shape, preservation rules |
| `security` | CanonicalSecurityMetadata | Telemetry, snapshot, sensitivity |

### CanonicalMessage

```typescript
interface CanonicalMessage {
  role: "system" | "user" | "assistant" | "tool";
  text?: string;
  parts?: CanonicalContentPart[];
  name?: string;
  metadata?: Record<string, unknown>;
}
```

### CanonicalContentPart

Rich content beyond plain text:

- `text` — plain text
- `code` — code block with optional language
- `json` — structured JSON data
- `file_ref` — reference to an attached file
- `image_ref` — reference to an image
- `summary_ref` — reference with inline summary

### CanonicalResponse

Post-run analysis uses a canonical response:

| Field | Type |
|-------|------|
| `requestId` | string |
| `outputMessages` | CanonicalMessage[] |
| `toolCalls` | CanonicalToolCall[]? |
| `usage` | { inputTokens, outputTokens, totalTokens }? |
| `latencyMs` | number? |
| `finishReason` | string? |

### CanonicalSecurityMetadata

Controls the security posture of every request:

- `telemetryMode` — off / local / cloud_redacted
- `promptSnapshotMode` — none / local_only / cloud_opt_in
- `containsSensitiveContent` — flag for extra redaction
- `allowCloudSync` — explicit opt-in for cloud
- `localOnly` — enforce local-only processing

### CanonicalPolicyHints

Output and behavior constraints that transforms must respect:

- `desiredOutputShape` — freeform / json / code / markdown / tool_call
- `prioritizeDeterminism` — reduce temperature-like variation
- `keepRecentTurns` — number of recent turns to preserve verbatim
- `preserveExactSections` — section names that must not be modified

## Data flow

```
External request
  → Adapter.toCanonicalRequest()
    → Feature Detection (canonical only)
      → Optimization Engine (canonical only)
        → Optimized CanonicalRequest
          → Provider call (if mode=on)
            → Adapter.fromCanonicalResponse()
              → External response
```
