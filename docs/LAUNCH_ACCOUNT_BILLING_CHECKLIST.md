# Account, API key & billing — one flow for all clients

## Mental model (non-negotiable)

There is **one Spectyra Cloud API** (your deployed `…/v1` on Railway or elsewhere) backed by **one Postgres** and **one Supabase Auth project**.

| Client | What it does | Cloud API used for |
|--------|----------------|-------------------|
| **Local Companion** (`spectyra-companion`) | Serves OpenClaw at `http://127.0.0.1:4111` (optimization + your LLM keys). | Sign-in, `POST /auth/ensure-account` (org + API key + trial), billing, license. |
| **Spectyra web** (spectyra.ai) | Dashboard, keys, billing UI. | Same `/v1` as companion. |
| **Desktop / OpenClaw Desktop** (Electron) | Embeds web + license checks. | Same Supabase + same `/v1` (see `environment.*.ts` / `SPECTYRA_API_URL`). |
| **OpenClaw skill `setup.sh`** | Terminal signup + `ensure-account`. | Same default Cloud API (override with `SPECTYRA_API_URL`). |

**Inference does not go through the Cloud API** when using the companion: OpenClaw → companion → **your** OpenAI/Anthropic/Groq key. The Cloud API is for **identity, org, trial, Stripe, and server-side features**.

**Fragility to avoid:** mixing **two Cloud API bases** (e.g. web on production Railway while companion has `SPECTYRA_API_URL` pointed at localhost) with **one Supabase user** — you’ll get confused org/trial state. For production, **everything should use the same production `https://…/v1`**.

---

## Step-by-step — ship billing + ClawHub

### 1) Database (Supabase / Postgres)

1. Apply all migrations in `supabase/migrations/` to the database your API uses (`DATABASE_URL` on Railway).
2. Confirm API boots and `GET /health` (or your health route) responds.

### 2) API on Railway (production Cloud API)

Set at least:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres (same DB migrations ran against). |
| `SUPABASE_URL` | Same project as clients (`…supabase.co`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin user lookup, owner routes, etc. |
| `SUPABASE_JWT_SECRET` or JWKS | JWT verification for `Authorization: Bearer`. |
| `STRIPE_SECRET_KEY` | Server-side Stripe API. |
| `STRIPE_WEBHOOK_SECRET` | Verifies `POST /v1/billing/webhook`. |
| `STRIPE_PRICE_ID` | Subscription price for Checkout (`/v1/billing/checkout`). |
| `STRIPE_TRIAL_DAYS` | Optional extra Stripe-side trial (often `0`; app trial is on `orgs.trial_ends_at`). |

In **Stripe Dashboard**:

1. Create Product + recurring Price → copy Price ID → `STRIPE_PRICE_ID`.
2. Add webhook endpoint: `https://<your-production-api-host>/v1/billing/webhook`, events at minimum: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and checkout completion if you use it.
3. Copy signing secret → `STRIPE_WEBHOOK_SECRET`.

### 3) Single public Cloud API URL

Decide the canonical production URL, e.g. `https://spectyra.up.railway.app/v1`.

- **Web prod build** (`environment.prod.ts`): `apiUrl` must match.
- **Companion default** (`tools/local-companion/src/cli.ts`): already defaults to that Railway host; users can set `SPECTYRA_API_URL` to override.
- **OpenClaw skill** (`setup.sh`): uses `SPECTYRA_API_URL` if set, else the same default.
- **Desktop Electron** (`SPECTYRA_API_URL` env): defaults to same Railway in code paths that validate license.

### 4) Supabase Auth

- Same **Supabase URL + anon key** in: web environments, `tools/local-companion/src/desktopSession.ts`, and `packages/openclaw-skill/setup.sh` (keep them in sync when rotating keys).
- Email confirmation: configure so `ensure-account` works after signup (confirm email or use your existing auto-confirm flow only in environments where that’s acceptable).

### 5) Publish clients users will install

1. **npm:** `@spectyra/local-companion` — build and publish from `tools/local-companion` per your release process.
2. **ClawHub / OpenClaw:** publish `packages/openclaw-skill` (artifact is `SKILL.md` + bundled files). Users run `openclaw skills install …` then follow skill + `spectyra-companion setup`.

### 6) Smoke test (production URL only)

1. Clear local state: `rm -rf ~/.spectyra/desktop ~/.spectyra/companion` (optional `rmdir ~/.spectyra` if empty).
2. **Do not** set `SPECTYRA_API_URL` (or set it explicitly to production `/v1`).
3. `npm i -g @spectyra/local-companion` (or use monorepo `pnpm` build + `npm link`).
4. `spectyra-companion setup` → new email → confirm `ensure-account` returns API key once; check DB: `orgs.trial_ends_at`, `org_memberships`, `api_keys`.
5. `spectyra-companion upgrade` (or web billing) → Stripe Checkout completes → webhook updates `orgs.subscription_status` etc.

### 7) Ongoing maintenance

- **Rotate keys** (Supabase anon, Stripe): update Railway + web build + `desktopSession.ts` + `setup.sh` together, or centralize via env-injected build in CI later.
- **Never** point half the stack at staging and half at prod for real users without documenting it.

---

## Quick reference: env override for companion

```bash
export SPECTYRA_API_URL="https://spectyra.up.railway.app/v1"
export SPECTYRA_WEB_ORIGIN="https://spectyra.ai"
spectyra-companion setup
```

Same `SPECTYRA_API_URL` for OpenClaw skill install script:

```bash
export SPECTYRA_API_URL="https://spectyra.up.railway.app/v1"
# then run skill setup or openclaw merge flow that invokes setup.sh
```
