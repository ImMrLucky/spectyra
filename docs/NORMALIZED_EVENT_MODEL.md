# Normalized event model

All adapters emit **`SpectyraEvent`** instances defined in `@spectyra/event-core` (`types.ts`).

## Event types (`SpectyraEventType`)

Includes lifecycle and provider signals, for example:

- `session_started`, `session_finished`
- `step_started`, `step_completed`
- `tool_called`, `tool_result`
- `optimization_simulated`, `optimization_applied`
- `provider_request_started`, `provider_request_completed`
- `prompt_comparison_available`
- `sync_state_changed`, `error`

## Shape

Each event has:

- **`id`**, **`type`**, ISO **`timestamp`**
- **`source`**: `adapterId`, `integrationType` (e.g. `sdk-wrapper`, `local-companion`, `openclaw-jsonl`), optional `toolName` / `toolVersion`
- **`sessionId`**, **`runId`**, optional **`stepId`**
- Optional **`appName`**, **`workflowType`**, **`provider`**, **`model`**
- **`payload`**: `Record<string, unknown>` — type-specific fields (token counts, transforms, latency, etc.)
- **`security`**: `telemetryMode`, `promptSnapshotMode`, `localOnly`, flags for prompt/response content presence

## Payload conventions (high level)

| Type | Typical payload |
|------|-----------------|
| `optimization_simulated` | estimated tokens before/after, transforms proposed, projected savings |
| `optimization_applied` | transforms applied, before/after sizes |
| `provider_request_completed` | input/output tokens, latency, cost estimate, success |
| `session_finished` | totals, status, elapsed time |
| `prompt_comparison_available` | local reference IDs only — no raw text in cloud payloads |

Adapters are responsible for mapping vendor records into these fields; **aggregators** only read generic keys and event types, not vendor product names as control flow.
