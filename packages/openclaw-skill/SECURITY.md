# Spectyra OpenClaw skill — security summary (for reviewers)

This pack installs **`@spectyra/local-companion`** and merges OpenClaw config so traffic can use **`spectyra/*`** models via a **local** HTTP server (`http://localhost:4111/v1`). There is **no cryptocurrency, wallet, or on-chain** logic in these files.

## LLM provider keys (OpenAI / Anthropic / Groq)

- **Invariant:** Your provider API key is written only to **`~/.spectyra/desktop/`** (e.g. `provider-keys.json` and embedded in local `config.json`) by **`setup.sh`** (see the “AI provider key” step) or by **`spectyra-companion setup`**.
- **Invariant:** That key is **not** sent to Spectyra’s cloud API for inference. The companion calls your provider **from your machine** after optimization.
- **Network use of provider keys:** none to `spectyra.ai` for provider authentication.

## What does go to Spectyra cloud (default API base in `setup.sh`; same backend as spectyra.ai)

- Account lifecycle: sign-in / ensure-account / license helpers used during setup (same product as the Spectyra web app).
- **Not included:** raw LLM provider secrets in those requests.

### setup.sh: outbound calls (so you don’t rely on a truncated view)

ClawHub sometimes **truncates** long scripts in the UI, so the model says it “cannot fully confirm” behavior. Here is what **`setup.sh` actually sends over the network** (grep the file to verify):

| Destination | Purpose | Body / data (summary) |
|-------------|---------|-------------------------|
| Supabase `…/signup`, `…/token` | Create session | **Email + password** for your Spectyra account (same as web signup). |
| `SPECTYRA_API/auth/ensure-account` | Provision org + Spectyra API key | JSON: `{}` or `{"org_name": "…"}` — **Bearer user JWT**. No LLM provider key. |
| `SPECTYRA_API/license/generate` | Optional license | JSON: `{"device_name":"openclaw-skill-setup"}` — **Bearer user JWT**. No LLM provider key. |
| `SPECTYRA_API/auth/auto-confirm` | Email confirm helper | JSON: `{"email":"…"}`. No LLM provider key. |

The **OpenAI / Anthropic / Groq** API key is read in the **“AI provider key”** section **after** account setup. It is passed only to an **embedded Python** snippet that writes **`~/.spectyra/desktop/provider-keys.json`** and updates local `config.json`. **There is no `curl` that posts `provider_key` or `SP_PROV_KEY` to Spectyra or Supabase.**

### Why ClawHub still says “can’t confirm”

That sentence is about **their display limit**, not a finding that your key was exfiltrated. Use this file + the **public repo** (see `skill.json` → `repository`) for a full line-by-line audit of `setup.sh`.

## Supabase

- The published **anon** key in `setup.sh` is a **public** Supabase client key (normal for client-side auth flows). It cannot bypass row-level security by itself.

## Payments

- **This skill does not process payments.** Optional paid plans are handled in the **Spectyra web application** (e.g. after sign-in at `https://spectyra.ai`), not by piping card data through this shell script.

## Files to audit

| File              | Role                                      |
|-------------------|-------------------------------------------|
| `SKILL.md`        | Human documentation                       |
| `setup.sh`        | Post-install wizard; see comments at top  |
| `config-fragment.json` | OpenClaw provider → localhost companion |
| `skill.json`      | Legacy metadata for older installers      |

For the full `setup.sh` source, use the copy in this repository or unpack the published zip from ClawHub — automated scans may truncate long scripts.
