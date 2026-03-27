# Local analytics and sync

## Defaults

- **Telemetry mode** defaults to local observation where supported; users can set `off` to disable emission.
- **Prompt snapshots** stay **local** unless the user explicitly opts into cloud behavior.
- **Normalized events and analytics** persist locally (companion / desktop / pluggable SDK persistence).
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

Local Companion exposes HTTP endpoints for health, current session, session list, session detail, prompt comparison by `runId`, and **SSE** `live-events` plus JSON `live-state` for real-time dashboards — all without calling Spectyra cloud.

## Desktop (macOS / Windows)

The Electron app bundles the same Local Companion and includes a **Live savings** screen (`/desktop/live-savings`) that:

- Subscribes to **SSE** `live-events` and polls **`live-state`** / **`current-session`** for the same normalized analytics as the SDK.
- Shows **step-level** token, cost, and transform detail, plus disk-backed **session history** (`~/.spectyra/companion/sessions.jsonl`).
- Offers an optional **“Sync redacted summaries”** toggle (stored in `localStorage`). When enabled and the user is **signed in** (Supabase session), completed sessions POST to **`POST /v1/analytics/sessions`** with `sessionToSyncedPayload` — **no raw prompts** in that payload.

Sign in from the desktop **Sign in** link (`/login`) so the auth interceptor can attach a JWT to API calls.
