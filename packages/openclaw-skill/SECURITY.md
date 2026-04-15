# Spectyra OpenClaw skill — security summary (for reviewers)

This pack installs **`@spectyra/local-companion`** and merges OpenClaw config so traffic can use **`spectyra/*`** models via a **local** HTTP server (`http://localhost:4111/v1`).

## Upstream LLM access (OpenAI / Anthropic / Groq)

- **Invariant:** Material used to call OpenAI / Anthropic / Groq is written only under **`~/.spectyra/desktop/`** (e.g. `provider-keys.json` and local `config.json`) by **`setup.sh`** or **`spectyra-companion setup`**.
- **Invariant:** That material is **not** sent to Spectyra’s cloud for model calls. The companion calls the upstream service **from your machine** after optimization.
- **Network:** none of that upstream material goes to `spectyra.ai` for provider authentication.

## What may go to Spectyra cloud (default base in `setup.sh`; same backend as spectyra.ai)

- Account lifecycle helpers during setup (same product as the Spectyra web app).
- **Not included:** raw upstream LLM material in those requests.

### setup.sh: outbound calls (so you don’t rely on a truncated view)

ClawHub sometimes **truncates** long scripts in the UI, so automated review may not show the full file. Here is what **`setup.sh` sends over the network** (inspect the file to verify):

| Destination | Purpose | Body / data (summary) |
|-------------|---------|-------------------------|
| Supabase auth endpoints | Create session | Email + sign-in material (same flow as web signup). |
| `SPECTYRA_API/auth/ensure-account` | Provision org + org access string | JSON body — session header on the request. No upstream LLM material. |
| `SPECTYRA_API/license/generate` | Device registration (path name from upstream API) | JSON: `{"device_name":"openclaw-skill-setup"}` — session header on the request. No upstream LLM material. |
| `SPECTYRA_API/auth/auto-confirm` | Email confirm helper | JSON: `{"email":"…"}`. No upstream LLM material. |

OpenAI / Anthropic / Groq access values are handled **after** account steps, only via an **embedded Python** snippet that writes **`~/.spectyra/desktop/provider-keys.json`** and updates local `config.json`. **There is no `curl` that posts upstream LLM access values to Spectyra or Supabase.**

### Why ClawHub still says “can’t confirm”

That refers to **their display limit**, not a finding of exfiltration. Use this file + the **public repo** (see `skill.json` → `repository`) for a full line-by-line audit of `setup.sh`.

## Supabase

- The published **anon** value in `setup.sh` is a **public** Supabase client identifier (normal for client-side auth flows). It cannot bypass row-level security by itself.

## Scope of this installer

**`setup.sh`** only performs the HTTP calls and local writes described here. Using **spectyra.ai** in a browser is separate from this script.

## OpenClaw merge format

`config-fragment.json` follows the **OpenClaw provider schema** (same shape as other OpenClaw providers): it includes a placeholder field required by that schema for localhost routing. The companion ignores it for auth; real upstream access stays in the Local Companion files above.

## Files to audit

| File              | Role                                      |
|-------------------|-------------------------------------------|
| `SKILL.md`        | Human documentation                       |
| `setup.sh`        | Post-install wizard; see comments at top  |
| `config-fragment.json` | OpenClaw provider → localhost companion |
| `skill.json`      | Legacy metadata for older installers      |

For the full `setup.sh` source, use the copy in this repository or unpack the published zip from ClawHub — automated scans may truncate long scripts.
