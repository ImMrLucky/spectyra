# Security — Spectyra OpenClaw Plugin

## Localhost-only control plane

This plugin performs **HTTP GET/POST only to `http://127.0.0.1:4111`**. It does not call remote Spectyra cloud APIs, third-party analytics, or provider endpoints.

## Advisory-only security (v1)

**Spectyra security warnings are advisory in v1.** They do not block, pause, interrupt, require confirmation, or cancel OpenClaw prompts, tool calls, or autonomous flows. This is intentional for users who run unattended agents.

## No privileged host access

The shipped runtime code:

- Does not import Node `child_process`, `fs`, or `os`
- Does not execute shell commands or spawn subprocesses
- Does not read environment variables for provider keys (`OPENAI`, `ANTHROPIC`, `AWS`, etc.)
- Does not read files from disk for prompt content

The OpenClaw host may expose optional APIs (e.g. `openExternal` for a dashboard link). The plugin only invokes such APIs when present; it never shells out on its own.

## Logging

Logging is restricted to **event types, correlation IDs, HTTP status, and error class names**. Prompt bodies, tool arguments, and credentials are not logged. Strings passed through the logger are passed through a redaction pass.

## Prompt security scanner

The scanner surfaces **non-blocking** notices and recommended actions. It does **not** require “Proceed anyway”, does not show cancel/stop/pause controls, and does **not** mutate outgoing prompt text. A **Sanitize Copy** action produces a redacted string for clipboard or read-only display only.

## Threat model

Compromise of the local companion process is out of scope for this package; the plugin assumes `127.0.0.1:4111` is the Spectyra companion you intentionally run.
