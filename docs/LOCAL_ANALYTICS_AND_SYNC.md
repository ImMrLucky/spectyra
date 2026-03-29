# Local analytics and sync

## Defaults

- **Telemetry mode** defaults to local observation where supported; users can set `off` to disable emission.
- **Prompt snapshots** stay **local** unless the user explicitly opts into cloud behavior.
- **Normalized events and analytics** persist locally (companion / desktop / pluggable SDK persistence).
- **Phase 5 learning** — Local Companion writes **`~/.spectyra/companion/learning-profile.json`** (transform success EMAs, detector calibration); no prompts inside. SDK can pass an in-memory `learningProfile` on `SpectyraConfig` instead.
- **Raw** vendor logs, traces, JSONL files, and **provider keys** are not uploaded by default.

## What may sync later (explicit opt-in)

When the user is signed in and enables sync, only **redacted, normalized summaries** should cross the wire, for example:

- Session and step metrics (tokens, savings, transforms, provider/model labels, timestamps)
- Security flags and sync state
- **No** raw prompts, responses, or full vendor event streams

Use `redactEventForCloudPreview` (or equivalent) from `@spectyra/event-core` when building payloads intended for the cloud.

## Retention

Product surfaces should offer local retention controls (e.g. 7 / 30 / 90 days, manual delete). Implementation is host-specific (SQLite for Electron, IndexedDB for web, etc.).

## Companion API

All below are **local-only** (no Spectyra cloud for inference). Phase 2 surfaces are marked.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Status, run mode, **`workflowPolicyMode`** (`enforce` \| `observe`), telemetry, `persistNormalizedEvents` |
| GET | `/config` | Bind host/port, aliases |
| POST | `/v1/chat/completions` | OpenAI-shaped proxy + optimization |
| POST | `/v1/messages` | Anthropic-shaped proxy + optimization |
| GET | `/v1/runs`, `/v1/runs/current` | Raw run reports (`runs.jsonl`) |
| GET | `/v1/savings/summary` | Aggregate over runs |
| GET | `/v1/prompt-comparison/:runId` | Local prompt diff metadata |
| GET | `/v1/analytics/current-session` | Active workflow session snapshot |
| GET | `/v1/analytics/sessions` | Completed sessions list |
| GET | `/v1/analytics/session/:id` | One session record |
| POST | `/v1/analytics/session/complete` | Finalize active session → `sessions.jsonl` |
| GET | `/v1/analytics/live-state` | **Phase 2** — aggregator snapshot from normalized events |
| GET | `/v1/analytics/live-events` | **Phase 2** — SSE `SpectyraEvent` stream |
| GET | `/v1/analytics/events/recent` | **Phase 2** — tail of `events.jsonl` |
| POST | `/v1/analytics/ingest` | **Phase 2** — adapter envelopes → bus + persistence |
| GET | `/v1/analytics/execution-graph/summary` | **Phase 3** — execution graph + step scores from in-memory events |
| GET | `/v1/analytics/state-delta/summary` | **Phase 4** — state snapshots + delta transition stats from in-memory events |
| GET | `/v1/analytics/workflow-policy/summary` | **Phase 6** — same policy evaluation as pre-provider on `POST /v1/chat/completions` and `POST /v1/messages` (default **enforce**; set **`SPECTYRA_WORKFLOW_POLICY=observe`** for reporting-only) |

- **`SPECTYRA_RUN_MODE`** — `off` \| `observe` \| `on` (companion default **`on`** when unset).
- **`SPECTYRA_WORKFLOW_POLICY`** — `observe` = evaluate only; anything else or unset = **`enforce`** (may **422** before provider).
- **`SPECTYRA_PERSIST_EVENTS=false`** — disable appending to `events.jsonl` (SSE still works).
- **`SPECTYRA_TELEMETRY=off`** — disables ingest, `events/recent`, and Phase 3–6 analytics summaries (403).

## Desktop (macOS / Windows)

The Electron app bundles the same Local Companion and includes a **Live savings** screen (`/desktop/live-savings`) that:

- Subscribes to **SSE** `live-events` and polls **`live-state`** / **`current-session`** for the same normalized analytics as the SDK. Phase 3/4 **execution-graph** and **state-delta** cards use the Companion HTTP summaries above; embedded SDK apps can compute the same payloads in-process with `moatPhase34SummariesFromSdkBuffer()` from `@spectyra/sdk`.
- Shows **step-level** token, cost, and transform detail, plus disk-backed **session history** (`~/.spectyra/companion/sessions.jsonl`).
- Offers an optional **“Sync redacted summaries”** toggle (stored in `localStorage`). When enabled and the user is **signed in** (Supabase session), completed sessions POST to **`POST /v1/analytics/sessions`** with `sessionToSyncedPayload` — **no raw prompts** in that payload.

Sign in from the desktop **Sign in** link (`/login`) so the auth interceptor can attach a JWT to API calls.
