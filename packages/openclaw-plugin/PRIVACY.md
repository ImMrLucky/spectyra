# Privacy — Spectyra OpenClaw Plugin

## Raw prompts and Spectyra cloud

**This plugin does not send raw prompts, completions, or provider secrets to Spectyra cloud.** Network access is limited to the local Spectyra companion at `http://127.0.0.1:4111`.

## Optional companion events

When the prompt security scanner finds issues, the plugin may `POST` a small **metadata-only** JSON envelope to `/openclaw/v1/events` (for example finding ids, categories, and severities). That payload is constructed to **exclude prompt text**. These events are **advisory only** and do not change your prompt. If the companion does not implement the route, failures are ignored.

## Savings and traces

Savings badges and flow summaries render **only** from JSON returned by companion trace/flow endpoints (or trace ids already present in OpenClaw message metadata). The plugin does not invent savings figures.
