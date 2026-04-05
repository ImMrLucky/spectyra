---
name: spectyra
description: "Token optimization for OpenClaw via Spectyra Local Companion. Reduces AI costs automatically by routing through spectyra/smart, spectyra/fast, or spectyra/quality model aliases. Use when: running any AI task through OpenClaw. No code changes required — just set your default model to spectyra/smart."
homepage: https://spectyra.com
metadata:
  {
    "openclaw":
      {
        "emoji": "⚡",
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

Spectyra reduces AI costs by routing OpenClaw requests through a local optimization proxy. No code changes required.

**How much you save** depends on your prompts, tools, and models. Use the **local dashboard** (`/dashboard`) and optional **benchmark script** (see repo `tools/local-companion/scripts/benchmark-savings.mjs`) to measure *your* workload — avoid treating any single percentage as a promise without measuring.

## Two ways to get set up

### Path A — You already use OpenClaw (e.g. found this skill on ClawHub)

1. Install the companion: `npm install -g @spectyra/local-companion`
2. Run **`spectyra-companion setup`** — Spectyra account, provider key on disk, OpenClaw provider + default model configured automatically when `openclaw` is on your PATH.
3. Run **`spectyra-companion start --open`** — keep this running; the browser shows **local savings**.
4. Use OpenClaw as usual (`spectyra/smart` or your chosen alias).

Optional: `openclaw skills install spectyra` if you want the skill docs inside OpenClaw; setup works the same.

### Path B — You start from Spectyra (account first, then OpenClaw)

1. Sign up / sign in to Spectyra and install **Spectyra Desktop** from [spectyra.com/download](https://spectyra.com/download).
2. Complete **Spectyra for OpenClaw** in the app — the wizard installs OpenClaw (if needed), saves your provider key, connects the Local Companion, and can install the Spectyra skill.
3. Open **Live** in Desktop for the full analytics UI, or open **http://127.0.0.1:4111/dashboard** in a browser anytime for the lightweight local savings page (same companion).

Both paths use the **same** Local Companion on `127.0.0.1:4111` — only run **one** companion process.

---

## Quick start (Path A — npm only)

Do these once, in order:

1. **Install the companion (npm)**

   ```bash
   npm install -g @spectyra/local-companion
   ```

2. **Guided setup** — Spectyra account, provider API key on disk, and OpenClaw wired to Spectyra models:

   ```bash
   spectyra-companion setup
   ```

3. **Start the companion and open your savings view**

   ```bash
   spectyra-companion start --open
   ```

   This starts the server on `http://127.0.0.1:4111` and opens **Local savings** in your browser. Leave this terminal running while you use OpenClaw.

   - Same thing later: run `spectyra-companion start`, then visit **http://127.0.0.1:4111/dashboard** or run `spectyra-companion dashboard`.

4. **Use OpenClaw** as usual (after setup, your default model should be `spectyra/smart`). Each completion updates the dashboard.

If anything fails, run `spectyra-companion status` and `curl http://127.0.0.1:4111/health`.

---

## When to Use

✅ **USE Spectyra models when:**

- Running any OpenClaw task and want lower costs
- You want automatic prompt optimization and semantic caching
- You want cost analytics and savings tracking (see **http://127.0.0.1:4111/dashboard** while the companion runs)
- You're using OpenAI, Anthropic, or Groq as your provider

❌ **DON'T use when:**

- You need direct, unmodified access to a specific provider model
- You're debugging prompt behavior and need raw pass-through

---

## Manual setup (if you skipped `spectyra-companion setup`)

### Spectyra account

Sign up at https://spectyra.com/register or run `spectyra-companion setup`.

### Provider key (stays on your machine)

```bash
mkdir -p ~/.spectyra/desktop
cat > ~/.spectyra/desktop/provider-keys.json << 'EOF'
{"openai": "sk-your-key-here"}
EOF
```

### Add Spectyra as an OpenClaw provider

```bash
openclaw config set models.providers.spectyra '{"baseUrl":"http://127.0.0.1:4111/v1","apiKey":"SPECTYRA_LOCAL","api":"openai-completions","models":[{"id":"smart","name":"Spectyra Smart","contextWindow":128000,"maxTokens":8192},{"id":"fast","name":"Spectyra Fast","contextWindow":128000,"maxTokens":8192},{"id":"quality","name":"Spectyra Quality","contextWindow":200000,"maxTokens":16384}]}' --strict-json
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

Optional: use the **Spectyra Desktop** app instead — it manages the same companion and adds a richer Live UI: https://spectyra.com/download

### Default model

```bash
openclaw config set agents.defaults.model.primary '"spectyra/smart"' --strict-json
```

---

## Model Aliases

| Model | Use for | Optimization level |
|-------|---------|-------------------|
| `spectyra/smart` | General tasks — best balance of quality and cost | Medium |
| `spectyra/fast` | Routine tasks — lowest latency and cost | Aggressive |
| `spectyra/quality` | Critical tasks — highest quality output | Minimal |

All three route through your configured provider (OpenAI, Anthropic, or Groq). The companion applies semantic caching, prompt compression, and smart routing automatically.

---

## Verify

```bash
spectyra-companion status
curl http://127.0.0.1:4111/health
curl http://127.0.0.1:4111/v1/models
openclaw chat -m spectyra/smart "Say hello"
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

- Inference stays on your machine; your provider key is not sent to Spectyra.
- **Savings and session analytics** are shown at **http://127.0.0.1:4111/dashboard** (local HTML served by the companion).
- Optional: sign in inside **Spectyra Desktop** or the web app to sync **redacted** summaries to your cloud account — not required for the local dashboard.

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
curl -fsSL https://spectyra.com/install.sh | bash
```

Then still run `spectyra-companion start --open` (or Desktop) before using OpenClaw.
