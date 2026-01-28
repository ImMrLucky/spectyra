# Customer Data Flow

This document describes **when and how customer data enters the system**: which files and functions are involved, the order of middleware, and what happens at each step. It covers both **machine auth** (API key / SDK) and **human auth** (dashboard / JWT) paths.

---

## 1. Entry Point: Express App

**File:** `apps/api/src/index.ts`

- **Helmet:** Security headers (CSP, COEP, CORP) applied globally.
- **CORS:** Origin check from `ALLOWED_ORIGINS`; allows `Content-Type`, `Authorization`, `X-SPECTYRA-API-KEY`, `X-PROVIDER-KEY`, `X-ADMIN-TOKEN`.
- **Body parsing:**
  - `/v1/billing/webhook` uses `express.raw({ type: "application/json" })` for Stripe signature verification.
  - All other routes use `express.json({ limit: "10mb" })`.
- **Database:** `initDb()` runs at startup.
- **Routes:** Routers are mounted (e.g. `/v1/chat`, `/v1/auth`, `/v1/replay`, etc.). No global auth; each router applies its own middleware.

**Output:** Incoming request has parsed body (where applicable) and is dispatched to the matching router.

---

## 2. Authentication: Two Paths

**File:** `apps/api/src/middleware/auth.ts`

Customer identity and tenant (org/project) are established by one of two methods.

### 2.1 Machine auth (API key / SDK)

- **Middleware:** `requireSpectyraApiKey`
- **Header:** `X-SPECTYRA-API-KEY` (full key; prefix `sk_spectyra_` first 12 chars).
- **Flow:**
  1. Read header; 401 if missing.
  2. Look up key by prefix via `getApiKeyByPrefix(keyPrefix)` → `orgsRepo.js`.
  3. Verify full key with argon2id via `verifyApiKey(apiKey, apiKeyRecord.key_hash)`.
  4. Check expiration (`expires_at`), then IP allowlist if `allowed_ip_ranges` is set.
  5. Load org with `getOrgById(apiKeyRecord.org_id)`; load project if `apiKeyRecord.project_id` is set.
  6. Optionally update last-used timestamp (async).
  7. Set `req.context = { org, project, apiKeyId }` and `req.auth = { orgId, projectId, scopes, apiKeyId }`.
- **Used by:** `/v1/chat`, `/v1/agent/*`, `/v1/replay`, `/v1/proof`, `/v1/auth/login` (and some auth/api-key routes when called with API key), `/v1/replay/simulate`, billing status when using API key.

**Output:** `req.context.org`, `req.context.project`, `req.context.apiKeyId` (and `req.auth`) set. Org/project are **never** taken from body or query; they come only from the API key record.

### 2.2 Human auth (dashboard)

- **Middleware:** `requireUserSession` then often `requireOrgMembership`
- **Header:** `Authorization: Bearer <supabase-jwt>`
- **Flow (requireUserSession):**
  1. Parse Bearer token; 401 if missing/invalid format.
  2. Verify JWT with Supabase JWKS (`jose` + `createRemoteJWKSet(jwksUrl)`), audience `authenticated`.
  3. Read `userId` from `payload.sub`.
  4. Set `req.auth.userId`, `req.context.userId`.
- **Flow (requireOrgMembership):** Used after `requireUserSession`. Org id from `params.orgId`, `query.org_id`, or `X-Org-Id`. Check `org_memberships` for `(org_id, user_id)`; optionally enforce domain allowlist and SSO via org settings. Set `req.context.org`, `req.auth.orgId`, `req.auth.role`, `req.context.userRole`.

**Output:** `req.auth.userId`, `req.context.userId`; after org membership, `req.context.org` and `req.auth.orgId`/role.

### 2.3 Optional: BYOK provider key

- **Middleware:** `optionalProviderKey`
- **Header:** `X-PROVIDER-KEY` (ephemeral; never stored).
- **Behavior:** Reads org from `req.context`/`req.auth`. Loads org settings; enforces:
  - `BYOK_ONLY` → 400 if header missing.
  - `VAULT_ONLY` → 400 if header sent.
  - Otherwise both allowed.
  If present, sets `req.context.providerKeyOverride` and `req.context.providerKeyFingerprint` (audit fingerprint). Used by chat, replay, proof, replay/simulate.

### 2.4 Optional: Trial / subscription gate

- **File:** `apps/api/src/middleware/trialGate.ts`
- **Middleware:** `requireActiveAccess` uses `hasActiveAccess(org)` (trial not expired or subscription active). If not active, responds 402 with billing info. Used by `/v1/chat`. Replay uses the same check inside the handler for non-estimator mode; estimator mode is allowed without active access.

---

## 3. Primary Customer Data Path: POST /v1/chat

**File:** `apps/api/src/routes/chat.ts`

This is the main path where customer **conversation data** and **model choices** enter and are processed.

### 3.1 Middleware order

1. `requireSpectyraApiKey` — establish org/project from API key.
2. `optionalProviderKey` — attach BYOK key if provided and allowed.
3. `requireActiveAccess` — ensure trial or subscription is active.

### 3.2 Handler: POST /

**Input (body):**

- `path`: `Path` (e.g. `"talk"` | `"code"`).
- `conversation_id`: optional.
- `provider`, `model`: string.
- `messages`: `Message[]` (role + content).
- `mode`: `Mode` (e.g. optimized vs baseline).
- `optimization_level`: optional number 0–4 (default 2).
- `dry_run`: optional boolean; if true, no real LLM call.

**Steps:**

1. **Validate:** Require `path`, `provider`, `model`, `messages`, `mode`; 400 if missing. Validate `optimization_level` in 0–4.
2. **Provider key resolution:**
   - `orgId` / `projectId` from `req.context` (or `req.auth`).
   - If `req.context.providerKeyOverride` (BYOK): `createProviderWithKey(provider, providerKeyOverride)` → `providerFactory.js`.
   - Else if org: try vaulted key via `getProviderCredential(orgId, projectId, provider)` → `providerCredentialsRepo.js`; if found, `createProviderWithKey(provider, vaultedKey)`.
   - Else: `providerRegistry.get(provider)` (env-backed default). If no provider, 400.
3. **Convert messages:** `messages` → `ChatMessage[]` (role + content) for optimizer.
4. **Optimizer setup:** `createOptimizerProvider(llmProvider)`, `getEmbedder("openai")`, `makeOptimizerConfig()`, `mapOptimizationLevelToConfig(path, optimizationLevel, baseConfig)`.
5. **Dry-run branch (dry_run === true):**
   - `runOptimizedOrBaseline(..., { dryRun: true })` → no real LLM call.
   - Token/cost estimates via `estimateBaselineTokens` / `estimateOptimizedTokens` (`proof/tokenEstimator.js`).
   - Respond with `run_id`, estimates, `baseline_estimate`, `optimized_estimate`, `savings` (estimated), `explanation_summary`; no DB write.
6. **Live branch:**
   - `runOptimizedOrBaseline(...)` → `services/optimizer/optimizer.js` (real LLM call via provider adapter).
   - Usage and cost: `estimateCost(usage, provider)`.
   - Build `RunRecord` (id, conversationId, mode, path, provider, model, promptFinal, responseText, usage, costUsd, quality, debug).
   - `computeWorkloadKey`, `computePromptHash` for savings/analytics.
   - **Persist:** `saveRun({ ...run, optimizationLevel, workloadKey, promptHash, debugInternal, orgId: req.context?.org.id, projectId: req.context?.project?.id, providerKeyFingerprint })` → `services/storage/runsRepo.ts`. Storage of prompt/response/debug is gated by org settings (`store_prompts`, `store_responses`, `store_internal_debug`).
   - If mode === `optimized`: `writeEstimatedSavings(...)` → `services/savings/ledgerWriter.js`.
   - **Response:** `redactRun(run)` strips internal/debug data → public-safe payload; then add `optimizations_applied`, `token_breakdown`; optionally `optimizer_debug` / `spectral_debug` if `EXPOSE_INTERNAL_DEBUG=true`. Send JSON.

**Output:** JSON response with run_id, usage, cost, savings (and estimates in dry-run). Stored run is scoped to org/project from context; prompt/response storage depends on org settings.

---

## 4. Other Customer Data Entry Points

### 4.1 POST /v1/auth/bootstrap (human)

**File:** `apps/api/src/routes/auth.ts`

- **Auth:** `requireUserSession` (Supabase JWT).
- **Body:** `org_name`, optional `project_name`.
- **Flow:** Validate org name; optional domain pre-check via Supabase admin; ensure user has no org yet; `createOrg(org_name, 7)`, `createProject(org.id, project_name || "Default Project")`, add `org_memberships` as OWNER; create first API key; audit log. Response includes org, project, api_key.

### 4.2 POST /v1/replay (machine)

**File:** `apps/api/src/routes/replay.ts`

- **Auth:** `requireSpectyraApiKey`, `optionalProviderKey`. No global `requireActiveAccess`; handler checks active access for non-estimator mode.
- **Body:** `scenario_id`, `provider`, `model`, `optimization_level`, `proof_mode` ("live" | "estimator").
- **Flow:** Load scenario from disk; for live mode run optimizer + optional quality guard; for estimator mode run dry-run and return estimates; optionally `saveRun` / `saveReplay`, `writeVerifiedSavings`. Response redacted via `redactReplayResult`.

### 4.3 POST /v1/proof/estimate (machine)

**File:** `apps/api/src/routes/proof.ts`

- **Auth:** `requireSpectyraApiKey`, `optionalProviderKey`.
- **Body:** `path`, `provider`, `model`, `optimization_level`, `messages`.
- **Flow:** No trial check. Build `ChatMessage[]`, run `runOptimizedOrBaseline(..., { dryRun: true })`, return token/cost estimates only (no persistence).

### 4.4 POST /v1/replay/simulate (machine)

**File:** `apps/api/src/routes/replaySimulate.ts`

- **Auth:** `requireSpectyraApiKey`, `optionalProviderKey`.
- **Body:** Scenario + provider/model–style inputs for simulation.
- **Flow:** Resolve provider (BYOK/vault/registry), run optimizer path in dry-run; return simulated result (no DB write).

### 4.5 POST /v1/agent/options and POST /v1/agent/events (machine, SDK)

**File:** `apps/api/src/routes/agent.ts`

- **Auth:** `requireSpectyraApiKey`, `requireSdkAccess`, then `rateLimit`.
- **Options body:** `run_id`, `prompt_meta` (e.g. promptChars, path, repoId, language, filesChanged, testCommand), `preferences` (budgetUsd, allowTools).
- **Flow:** Org/project from `req.context`. `decideAgentOptions({ orgId, projectId, promptMeta, preferences })` → policy engine; `createAgentRun(...)`; return options.
- **Events body:** Event payload for agent run.
- **Flow:** `insertAgentEvent(...)` to record event. Both paths require SDK access enabled for the org.

### 4.6 GET /v1/usage (human)

**File:** `apps/api/src/routes/usage.ts`

- **Auth:** `requireUserSession`.
- **Flow:** Resolve org from `org_memberships` by `req.auth.userId`. Query `runs` and `agent_runs` by `org_id` and date range; return usage aggregates (calls, tokens, cost). No customer payload in body; org is inferred from membership.

### 4.7 Dashboard routes (human, org-scoped)

- **Settings:** `apps/api/src/routes/settings.ts` — `requireUserSession`, `requireOrgMembership`; get/update org or project settings.
- **Runs:** `apps/api/src/routes/runs.ts` — `requireUserSession`, `requireOrgMembership`; list/get runs for the org (and optional project filter).
- **Savings:** `apps/api/src/routes/savings.ts` — same auth; read-only savings summary/timeseries/export.
- **Audit:** `apps/api/src/routes/audit.ts` — `requireUserSession`, `requireOrgMembership`; read audit log for org.
- **Provider keys:** `apps/api/src/routes/providerKeys.ts` — `requireUserSession`, `requireOrgMembership`, `requireOrgRole("ADMIN")`; manage vaulted provider keys for org.
- **Billing:** `apps/api/src/routes/billing.ts` — checkout/status with either JWT or API key; webhook is unauthenticated but verifies Stripe signature.

---

## 5. Summary Table

| Route / area        | Auth              | Customer data in          | Main output / side effect                    |
|---------------------|-------------------|---------------------------|----------------------------------------------|
| POST /v1/chat       | API key + optional BYOK + trial | body: path, provider, model, messages, mode, options | Run record, savings ledger, redacted JSON    |
| POST /v1/auth/bootstrap | JWT            | body: org_name, project_name | Org, project, first API key, membership      |
| POST /v1/replay     | API key + optional BYOK | body: scenario_id, provider, model, proof_mode, etc. | Replay/run records, savings, redacted result |
| POST /v1/proof/estimate | API key + optional BYOK | body: path, provider, model, messages | Token/cost estimates only                    |
| POST /v1/replay/simulate | API key + optional BYOK | body: scenario + provider/model | Simulated run result (no DB)                 |
| POST /v1/agent/options, /events | API key + SDK access | body: prompt_meta, preferences, events | Agent run + options; event rows               |
| GET /v1/usage       | JWT               | query: range, groupBy     | Usage aggregates for user’s org              |
| Settings, runs, savings, audit, provider keys | JWT + org membership | params/query (org/project id) | Read/update org-scoped data                  |

---

## 6. Key Files Reference

| Purpose              | File(s) |
|----------------------|--------|
| App entry, CORS, body, routes | `apps/api/src/index.ts` |
| Auth: API key, JWT, BYOK, org membership, SDK access | `apps/api/src/middleware/auth.ts` |
| Trial/subscription gate | `apps/api/src/middleware/trialGate.ts` |
| Chat (main customer data path) | `apps/api/src/routes/chat.ts` |
| Optimizer (LLM + optimization) | `apps/api/src/services/optimizer/optimizer.js` |
| Provider resolution  | `apps/api/src/services/llm/providerRegistry.js`, `providerFactory.js`, `providerCredentialsRepo.js` |
| Persist runs         | `apps/api/src/services/storage/runsRepo.ts` |
| Savings ledger       | `apps/api/src/services/savings/ledgerWriter.js` |
| Redaction            | `apps/api/src/middleware/redact.ts` |
| Auth bootstrap       | `apps/api/src/routes/auth.ts` |
| Replay, proof, agent, usage | `apps/api/src/routes/replay.ts`, `proof.ts`, `agent.ts`, `usage.ts` |

---

## 7. Simple explanation (for talking through the flow)

**When a customer sends data, what actually happens?**

1. **Request hits the API.**  
   The app receives the request, adds security headers, checks CORS, and parses the JSON body. Then it sends the request to the right route (e.g. `/v1/chat`).

2. **We figure out who they are.**  
   - **Apps/SDK:** They send an API key in a header. We look it up, verify it, and from that we know their org and project. We never trust org or project from the request body—only from the key.  
   - **Dashboard:** They send a login token (JWT). We verify it with Supabase, get their user id, then check which org they belong to.  
   Optionally we also read a “bring your own key” header if they’re using their own LLM key, and we check that their trial or subscription is still active for paid actions.

3. **We handle their data.**  
   - **Main path (chat):** They send messages + provider/model + options. We resolve which LLM key to use (theirs, our vault, or a default), run the optimizer (or baseline), call the LLM, then save the run under their org/project. What we store (prompts, responses, debug) depends on their org settings. We strip internal details before sending the response back.  
   - **Other paths:** Bootstrap creates their first org and API key. Replay/proof/agent send different kinds of input (scenarios, estimates, agent options/events); we auth the same way, then run the right logic and sometimes save runs or savings.

4. **We never trust identity from the request body.**  
   Org and project always come from the API key or from the user’s org membership. That keeps each customer’s data isolated to their tenant.
