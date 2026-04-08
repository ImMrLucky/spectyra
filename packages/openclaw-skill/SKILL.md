---
name: spectyra
description: "Shrink LLM prompts (input tokens) for OpenClaw via Spectyra Local Companion — works with chat and tool-using agents. Account + API key from setup. Use spectyra/smart (or fast/quality). Dashboard at http://127.0.0.1:4111/dashboard shows estimated $ saved and simpler metrics."
homepage: https://spectyra.ai
metadata:
  {
    "openclaw":
      {
        "emoji": "◈",
        "requires": { "bins": ["spectyra-companion"], "any": true },
        "install":
          [
            {
              "id": "npm",
              "kind": "node",
              "package": "@spectyra/local-companion",
              "bins": ["spectyra-companion"],
              "label": "Install Spectyra Local Companion (npm)",
            },
          ],
      },
  }
---

# Spectyra — Token Optimization for OpenClaw

Spectyra is an AI optimization layer that reduces AI costs through a local app companion and lowers OpenClaw token usage. No code changes, only configuration. How much you save depends on what you do with OpenClaw.


**You need a Spectyra account and API key** (email + password) to get started. This is created as you setup the local savings companion.

---

## What you save (simple)

1. **Money on input** — The LLM bill has two parts: **input** (everything you send, including long tool results and chat history) and **output** (the model’s reply). Spectyra mainly saves money by making the **input smaller** (shorter tool output, less repeat text, safer trims) before it goes to OpenAI, Anthropic, or Groq.

2. **OpenClaw + tools** — Works for normal chat **and** agent flows that use **tools** (code, tasks, long runs). We keep **tool calls** and message order valid while still trimming where it’s safe.

3. **The dashboard** — After `spectyra-companion start`, open **http://127.0.0.1:4111/dashboard**. The big number is **estimated dollars** from input savings. Below that: **how many input tokens** you avoided, **reply tokens** when the API reports them, plus simple scores (conversation steadiness, repeats, etc.). Dollar amounts are **estimates** — your real bill may differ slightly.

4. **If you see $0** — You might be in **Observe** (preview only), still **without a license** (we show “could have saved” but don’t always change what the provider receives), or those calls had nothing to trim yet.

---

## Install (once)
**Use either macOS (Terminal) or Windows (Cmd Prompt)**
```bash
# install spectyra skill
openclaw skills install spectyra

# install local savings companion
npm install -g @spectyra/local-companion@latest
```

---

## Setup (once)

Run this once after the skill and npm package are installed:

```bash
spectyra-companion setup
```

**What it does:** an interactive wizard in your terminal that walks through first-time configuration. It does **not** start the optimization server by itself; it **writes config** and (when possible) **configures OpenClaw** for you.

| What gets set up                            | What it means                                                                                                                                                                                   |
|---------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Spectyra account**                        | Sign up or sign in with **email and password** so usage is tied to your org (analytics, billing, upgrades).                                                                                     |
| **Spectyra API key**                        | Saved locally so the companion can authenticate to Spectyra services.                                                                                                                           |
| **LLM provider key**                        | Your OpenAI / Anthropic / Groq key is stored **on disk** (e.g. under `~/.spectyra/…`) for the companion to call the real provider after optimization. It is not sent to Spectyra for inference. |
| **OpenClaw** (if `openclaw` is `Installed`) | Adds the **Spectyra provider** ( `spectyra/smart` and related models) and sets the **default model** so new OpenClaw sessions use Spectyra. You can always change models at any time.           |

If `openclaw` is not installed or not on `PATH`, finish provider keys and account steps here anyway; you can paste the Spectyra provider block into OpenClaw later (see **Manual setup**).

---

## Usage

**Start the companion** (keep this terminal open):

```bash
spectyra-companion start --open
```

That opens **local savings** at **http://127.0.0.1:4111/dashboard**. Then use OpenClaw as usual with **`spectyra/smart`** (or `spectyra/fast` / `spectyra/quality`).

If anything fails: `spectyra-companion status` and `curl http://127.0.0.1:4111/health`.

**Note:** Only **one** Local Companion process should run (default port `4111`).

---

## OpenClaw model selection (aligned with how OpenClaw works)

OpenClaw picks a model in roughly this **priority** (highest first):

1. **Session / task / run override** — e.g. the model explicitly set for that chat, cron, or agent run (`spectyra/smart`, `openai/gpt-5.1`, etc.).
2. **Global default** — often `agents.defaults.model.primary` in `~/.openclaw/config.json` (or the path your OpenClaw version uses for the same idea).
3. **Skill / agent defaults** — some skills pin a cheaper or specialized model when that skill is active.

**When you get Spectyra optimization + savings:** the **resolved model id** for that call must be a **Spectyra alias** (see **Model aliases** below): the three default lanes **`spectyra/smart`**, **`spectyra/fast`**, **`spectyra/quality`**, or an explicit vendor lane like **`spectyra/anthropic/quality`** / **`spectyra/openai/smart`**. OpenClaw routes the request to the **Spectyra** provider entry (`models.providers.spectyra` → `http://127.0.0.1:4111/v1`), and the Local Companion runs optimization before calling your LLM.

**When Spectyra does *not* run:** if you choose a **direct vendor model** (e.g. a bare `gpt-*` / `claude-*` / `openai/...` entry that hits the vendor API **without** going through the Spectyra provider), that traffic **bypasses** the companion — no savings on that call.

**What we configure for compatibility:** the skill merge + **`spectyra-companion setup`** (when `openclaw` is available) set:

- `models.providers.spectyra` — localhost URL, OpenAI-compatible API, and the registered `spectyra/*` model list (default lanes plus per-vendor lanes).
- `agents.defaults.model.primary` — **`spectyra/smart`** so normal sessions default through Spectyra unless something overrides it.

**How `spectyra/smart` becomes a real LLM call:** the companion maps each alias to **one upstream model id** per alias (see `aliasSmartModel` / `aliasFastModel` / `aliasQualityModel` in `~/.spectyra/desktop/config.json`) for the **provider** you chose at setup (OpenAI, Anthropic, or Groq). It does **not** automatically rotate between unrelated vendor models every turn; adjust those fields to match the models you want behind each alias.

### Does Spectyra “pick the best model” (e.g. Claude Opus vs GPT‑5) by itself?

**Not today.** The Local Companion does **not** infer task type and then switch between Anthropic vs OpenAI or Opus vs mini on the fly. Its job is **optimization**: fewer tokens / smarter context on the way to **whatever upstream model you wired** to each alias.

- **`spectyra/smart`**, **`spectyra/fast`**, **`spectyra/quality`** are three **default lanes** tied to your config **`provider`** plus **`aliasSmartModel`** / **`aliasFastModel`** / **`aliasQualityModel`**.
- **Multi-vendor workflows:** use explicit ids **`spectyra/<openai|anthropic|groq>/<smart|fast|quality>`**. Each id fixes the **upstream API** for that call (e.g. `spectyra/anthropic/quality` for a Claude review, `spectyra/openai/smart` for GPT research) while still going through the companion for optimization. Put **API keys for every vendor you use** in `~/.spectyra/desktop/provider-keys.json` (or env). Optional **`providerTierModels`** in `~/.spectyra/desktop/config.json` sets real model ids per vendor per tier (e.g. Opus on `anthropic/quality`, Sonnet on `anthropic/smart`); omitted tiers use that vendor’s defaults.
- **Different agents, different needs:** in OpenClaw, assign agents or steps the **model id** they need (`spectyra/anthropic/quality` vs `spectyra/openai/fast`, etc.). Same idea as before for the default three lanes: OpenClaw picks the **alias**; Spectyra maps it to the **configured** upstream model for that lane.
- **Savings require Spectyra on the path:** if a run uses a **direct vendor** model string and never hits `spectyra/*`, Spectyra does not see that traffic — **no savings** for that call. Defaulting agents to `spectyra/smart` (or fast/quality) is how you maximize coverage.

**OpenClaw default for agents:** your OpenClaw version may use `agents.defaults.model`, `agents.defaults.model.primary`, or another key — use **`openclaw doctor`** or OpenClaw’s own docs and set the default to **`spectyra/smart`** (or another `spectyra/*` alias) so launches that don’t override the model still route through the companion.

---

## When to Use

✅ **USE Spectyra models when:**

- Running any OpenClaw task and want lower costs
- You want smaller prompts (especially long tool output and history) before they hit the provider
- You want savings and usage on the **local dashboard** (**http://127.0.0.1:4111/dashboard** while the companion runs)
- You're using OpenAI, Anthropic (Claude), or Groq as your provider

---

## Manual setup (if you skipped `spectyra-companion setup`)

### Spectyra account and API key

You still need a **Spectyra account** and **Spectyra API key**. Prefer **`spectyra-companion setup`** — it creates an account or signs you in (email/password) and provisions your key. Or create the account in the Spectyra web app, copy your API key from Settings, and place it in companion config as documented for your install path.

### Provider key (stays on your machine)

```bash
mkdir -p ~/.spectyra/desktop
cat > ~/.spectyra/desktop/provider-keys.json << 'EOF'
{"openai": "sk-your-key-here"}
EOF
```

### Add Spectyra as an OpenClaw provider

```bash
openclaw config set models.providers.spectyra '{"baseUrl":"http://127.0.0.1:4111/v1","apiKey":"SPECTYRA_LOCAL","api":"openai-completions","models":[{"id":"spectyra/smart","name":"Spectyra Smart","contextWindow":128000,"maxTokens":8192},{"id":"spectyra/fast","name":"Spectyra Fast","contextWindow":128000,"maxTokens":8192},{"id":"spectyra/quality","name":"Spectyra Quality","contextWindow":200000,"maxTokens":16384}]}' --strict-json
```

### Start the companion

```bash
SPECTYRA_PORT=4111 \
SPECTYRA_BIND_HOST=127.0.0.1 \
SPECTYRA_PROVIDER=openai \
SPECTYRA_PROVIDER_KEYS_FILE=~/.spectyra/desktop/provider-keys.json \
SPECTYRA_RUN_MODE=on \
spectyra-companion start --open
```

### Default model

```bash
openclaw config set agents.defaults.model.primary '"spectyra/smart"' --strict-json
```

---

## Model Aliases

**Default lanes** (use your config `provider` + `alias*` model ids):

| Model | Use for | Optimization level |
|-------|---------|-------------------|
| `spectyra/smart` | General tasks — best balance of quality and cost | Medium |
| `spectyra/fast` | Routine tasks — lowest latency and cost | Aggressive |
| `spectyra/quality` | Critical tasks — highest quality output | Minimal |

**Explicit vendor lanes** (same three tiers per vendor): `spectyra/openai/smart`, `spectyra/openai/fast`, `spectyra/openai/quality`, `spectyra/anthropic/…`, `spectyra/groq/…`. Use these when different agents or steps should hit **different** APIs (e.g. coding on Anthropic, drafting on OpenAI) without swapping companion config. Tier → model mapping uses `providerTierModels` in desktop config when set; otherwise each vendor’s defaults.

The companion runs optimization (prompt compression, tool-safe trims, etc.) on every request that uses a Spectyra alias.

---

## Verify

```bash
spectyra-companion status
curl http://127.0.0.1:4111/health
curl http://127.0.0.1:4111/v1/models
# If your OpenClaw build supports it — otherwise use Control UI / gateway as you normally do:
openclaw agent --local --message "Say hello" --json
```

Open **http://127.0.0.1:4111/dashboard** — you should see runs and session rows after chatting.

---

## Architecture

```
OpenClaw Agent (uses spectyra/smart)
    ↓
Spectyra Local Companion (localhost:4111)
    ↓ optimizes tokens, caches, routes
Your AI Provider (OpenAI / Anthropic / Groq)
```

- Inference stays on your machine; your **LLM provider** key is not sent to Spectyra for chat forwarding.
- **Savings** show at **http://127.0.0.1:4111/dashboard** while the companion runs.
- Your **Spectyra account and API key** link this usage to **Spectyra** for org-level analytics, billing, and plan changes (same account as the web app).

---

## Troubleshooting

```bash
spectyra-companion status
curl http://127.0.0.1:4111/health
cat ~/.spectyra/companion/companion.log
pkill -f spectyra-companion   # if you need a clean restart
spectyra-companion start --open
openclaw doctor
```

---

## One-line installer (alternative)

```bash
curl -fsSL https://spectyra.ai/install.sh | bash
```

Then run `spectyra-companion setup` and `spectyra-companion start --open` before using OpenClaw.

---

## Not coming from OpenClaw here?

Everything above is for **OpenClaw + `spectyra-companion`**. If you landed elsewhere:

- **Spectyra Desktop** ([spectyra.ai/download](https://spectyra.ai/download)) — installer and **OpenClaw** wizard in-app; same underlying companion when you use OpenClaw.
- **`@spectyra/sdk`** — embed optimization in your own Node app; savings are returned as **`SavingsReport`** on each call (see SDK docs on [npm](https://www.npmjs.com/package/@spectyra/sdk) or your integration guide).
