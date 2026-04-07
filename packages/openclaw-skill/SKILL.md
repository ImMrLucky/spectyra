---
name: spectyra
description: "Token optimization for OpenClaw via Spectyra Local Companion. Route through spectyra/smart, spectyra/fast, or spectyra/quality. After spectyra-companion start, open local savings at http://127.0.0.1:4111/dashboard (or run spectyra-companion start --open). Use when: any OpenClaw task where you want lower token cost."
homepage: https://spectyra.ai
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

**How much you save** depends on your prompts, tools, and models. Use the **local dashboard** and optional **benchmark script** (see repo `tools/local-companion/scripts/benchmark-savings.mjs`) to measure *your* workload — avoid treating any single percentage as a promise without measuring.

**Setup vs savings:** **`spectyra-companion setup`** runs in the **terminal** and handles **Spectyra sign-up or sign-in**, **license/API key provisioning**, **LLM provider key**, and **OpenClaw wiring** — you do **not** need to visit the website first. **`http://127.0.0.1:4111/dashboard`** in the **browser** is only for **savings** (after `spectyra-companion start --open` or `dashboard`).

---

## Get started (OpenClaw + Local Companion)

Do these **once**, in order:

1. **Install this skill** (if you have not already):

   ```bash
   openclaw skills install spectyra
   ```

2. **Install the Local Companion** (npm package that provides `spectyra-companion`):

   ```bash
   npm install -g @spectyra/local-companion
   ```

3. **Guided setup** — Spectyra account, provider API key on disk, OpenClaw provider + default model (when `openclaw` is on your `PATH`):

   ```bash
   spectyra-companion setup
   ```

4. **Start the companion and open savings in the browser:**

   ```bash
   spectyra-companion start --open
   ```

   Leave this terminal **running**. The browser opens **local savings** at **http://127.0.0.1:4111/dashboard**. Later, use `spectyra-companion start` then visit that URL, or run `spectyra-companion dashboard`.

5. **Use OpenClaw** as usual — default model should be **`spectyra/smart`**. Each completion updates the dashboard.

If anything fails: `spectyra-companion status` and `curl http://127.0.0.1:4111/health`.

**Note:** Only **one** Local Companion process should run (default port `4111`).

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

Use **`spectyra-companion setup`** — it creates an account or signs you in and provisions keys in the terminal. (The marketing site is optional.)

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

- Inference stays on your machine; your provider key is not sent to Spectyra.
- **Savings and session analytics** are shown at **http://127.0.0.1:4111/dashboard** (local HTML served by the companion).
- Optional: sign in to the **Spectyra web app** to sync **redacted** summaries to your cloud account — not required for the local dashboard.

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
