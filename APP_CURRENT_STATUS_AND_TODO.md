# Spectyra — Current App Status & TODO

**Purpose:** Snapshot of features, architecture, and follow-up work for new chat sessions.  
**Last updated:** 2026-03-31

---

## Product summary (from repo)

Spectyra is **local-first LLM token/cost optimization**: it optimizes prompts and tracks savings **without proxying inference data** by default. Surfaces include the **Angular web app** (cloud dashboard), **Electron desktop** (bundles **Local Companion**), **`@spectyra/sdk`**, **`@spectyra/agents`** (`packages/spectyra-agents` — coding-agent helpers), and optional **browser extension** / **enterprise proxy**. Provider keys are BYOK; cloud features are opt-in (e.g. redacted analytics sync).

---

## Monorepo layout

| Area | Path | Role |
|------|------|------|
| Web UI | `apps/web` | Angular app (browser + Electron renderer) |
| API | `apps/api` | Express backend (auth, orgs, billing, runs, analytics sync, studio, agent SDK routes, etc.) |
| Desktop shell | `apps/desktop` | Electron main/preload; bundles Angular `desktop` build; spawns Local Companion |
| Local Companion | `tools/local-companion` | OpenAI/Anthropic-compatible localhost server; optimization + analytics SSE/JSONL |
| Shared libs | `packages/*` | Types, SDK, event-core, analytics-core, execution-graph, workflow-policy, `@spectyra/agents`, etc. |
| Docs | `docs/SPECTYRA_ARCHITECTURE.md` | Single architecture + API map for new sessions |
| Optional | `extensions/browser-extension`, `tools/proxy`, `tools/cli` | Browser intercept, enterprise proxy, CLI |

**Brand / UI:** `spectyra-brand.md` — Source Sans Pro (display), DM Sans (body), DM Mono (code).  
**Web app:** Light theme by default. **Desktop (Electron):** Dark surfaces scoped under `.desktop-app` in global styles.

**Icons:** Large master icon `apps/desktop/assets/icon.png` (1024×1024 PNG) for Electron Builder + `BrowserWindow` icon; smaller `apps/web/src/assets/spectyra-icon.png` for in-app headers; `apps/web/src/favicon.ico` for the browser tab.

---

## Packages (`packages/` — workspace)

| Package | Role |
|---------|------|
| `@spectyra/sdk` | In-process optimization + sessions; `createSpectyra`, adapters |
| `@spectyra/spectyra-agents` | CodeMap / RefPack / PhraseBook-style helpers for agent coding loops |
| `@spectyra/event-core` | Normalized events, session model |
| `@spectyra/event-adapters` | OpenClaw JSONL, Claude hooks, OpenAI tracing, SDK, local companion adapters |
| `@spectyra/analytics-core` | Session/step analytics |
| `@spectyra/execution-graph`, `@spectyra/state-delta`, `@spectyra/workflow-policy` | Summaries consumed by companion + Live UI |
| `@spectyra/optimization-engine`, `@spectyra/optimizer-algorithms`, `@spectyra/learning` | Optimization pipeline + learning hooks |
| `@spectyra/core-types`, `@spectyra/shared`, `@spectyra/canonical-model`, `@spectyra/integration-metadata` | Shared types and models |
| `@spectyra/adapters`, `@spectyra/engine-client`, `@spectyra/feature-detection`, `@spectyra/prompt-diff-core`, `@spectyra/security-core` | Supporting libraries |

---

## Web app (`apps/web`)

Single Angular codebase; routing switches via `environment.isDesktop` (`app.routes.ts` composes web vs desktop routes).

### Public / marketing

- `/` — Home / marketing
- `/login`, `/register` — Auth (Supabase and/or API key bootstrap flows)

### Authenticated product (typical SaaS) — `app.routes.web.ts`

| Route | Feature |
|-------|---------|
| `/overview` | Dashboard / KPIs |
| `/studio` | Studio — prompt optimization lab (scenarios) |
| `/observe` | Observe (Optimizer Lab UI; legacy redirects from `/optimizer-lab`) |
| `/integrations`, `/integrations/:slug` | Integration docs / setup |
| `/download` | Desktop app download |
| `/runs`, `/runs/:id` | Optimization runs |
| `/usage` | Usage |
| `/analytics` | Savings analytics |
| `/billing` | Plan & billing |
| `/policies` | Workflow / optimization policies |
| `/projects` | Projects |
| `/audit` | Audit logs |
| `/settings`, `/settings/security`, `/settings/provider-keys` | Account, security, provider keys |
| `/admin` | Org admin (owner-gated in UI) |
| `/superuser` | Platform superuser console (`superuserGuard`) |

Redirects: `/optimizer-lab` → `/observe`, `/savings` → `/usage`, etc.

**Shell:** Header with logo + wordmark; collapsible sidenav with section groupings (Product, Analytics, Manage, Admin). Org switcher when authenticated.

### Components present but **not** wired in main web routes

These exist under `apps/web/src/app/features/` but have **no** `path` in `app.routes.web.ts` / `app.routes.desktop.ts` (may be legacy or reserved for future wiring):

- `scenarios/scenarios.page.ts` — scenario list UI (API has `/v1/scenarios`)
- `proof/proof.page.ts` — proof estimate UI (API has `/v1/proof`)
- `run/run.page.ts` — run detail shell used with scenarios/replay patterns

If you need them in the product, add routes and nav entries; otherwise treat as internal or remove after confirming no dynamic load.

---

## Desktop app (`apps/desktop` + desktop routes)

Electron loads the Angular **desktop** build. Main process: `apps/desktop/electron/main.ts` (bundled to CommonJS via esbuild). Preload: `preload.ts`. Companion started as child process; config under `~/.spectyra/desktop`.

### Desktop routes — `app.routes.desktop.ts`

| Route | Feature |
|-------|---------|
| `/desktop/live` | **Primary:** Live split dashboard (agent activity + Spectyra intelligence) — SSE + polled summaries, optional cloud sync |
| `/desktop/sessions` | Sessions |
| `/desktop/history` | History |
| `/desktop/compare` | Compare |
| `/desktop/agent-companion` | Agent Companion **multi-step wizard** (runtime → path → connection → configure → validate → go live) |
| `/desktop/openclaw` | OpenClaw setup wizard |
| `/desktop/onboarding` | Onboarding |
| `/desktop/security`, `/desktop/settings` | Desktop-focused security & settings |
| `/desktop/runs` | Runs |
| `/desktop/dashboard` | Dashboard hub |
| `/login`, `/integrations*`, `/superuser` | Shared with web where included |

Legacy: `/desktop/live-legacy` — older live view; `/desktop/live-savings` redirects to `/desktop/live`.

**Packaging:** `electron-builder.yml` — `buildResources: assets` (uses `assets/icon.png` for macOS/Windows icons). Artifacts under `apps/desktop/release/`.

---

## Local Companion (`tools/local-companion`)

- Listens on **127.0.0.1** (default port **4111**, configurable).
- **OpenAI-compatible** `/v1/chat/completions` and **Anthropic-compatible** `/v1/messages`; model aliases `spectyra/smart`, `spectyra/fast`.
- **Modes:** `off` / `observe` / `on` (optimization), plus license/trial behavior in engine.
- **Runs / savings:** `GET /v1/runs`, `/v1/runs/current`, `/v1/savings/summary`, `/v1/prompt-comparison/:runId`
- **Analytics:** `GET /v1/analytics/*` (sessions, current session, live-events SSE, live-state, execution-graph / state-delta / workflow-policy summaries, **`GET /v1/analytics/events/recent`** tail of JSONL, **`POST /v1/analytics/ingest`** for adapter-shaped events)
- **Health / config:** `GET /health`, `GET /config`

Desktop sets env (run mode, telemetry, provider aliases, license) and starts this process when the app runs.

**Integration tiers** (see `docs/SPECTYRA_ARCHITECTURE.md`): SDK in-process → Companion HTTP → JSONL/log tail → generic ingest.

---

## Cloud API (`apps/api`) — mounted routes (`src/index.ts`)

| Prefix | Notes |
|--------|--------|
| `/health` | Health |
| `/v1/providers` | Providers |
| `/v1/scenarios` | Scenarios |
| `/v1/chat` | Chat |
| `/v1/replay`, `/v1/replay/simulate` | Replay / simulate |
| `/v1/runs` | Runs |
| `/v1/savings` | Savings |
| `/v1/admin` | Admin (+ legacy optimizer paths under same mount) |
| `/v1/observe` | Observe optimizer (health + optimize) |
| `/v1` | Studio (`POST /v1/studio/run`, etc.) |
| `/v1/proof` | Proof estimates |
| `/v1/billing` | Billing (+ Stripe webhook sub-route) |
| `/v1/superuser` | Superuser |
| `/v1/auth` | Auth |
| `/v1/license` | License |
| `/v1/integrations` | Integrations |
| `/v1/agent` | **SDK agent control plane** — policy/options for prompts; **not** a multi-agent fleet CRUD API |
| `/v1/policies` | Policies |
| `/v1/audit` | Audit |
| `/v1/usage` | Usage |
| `/v1/analytics` | Analytics sync |
| `/v1/orgs` | Provider keys + org settings |
| `/v1/projects` | Project settings |
| `/scim` | SCIM (may return 501 for unsupported ops) |
| `/internal/retention` | Retention worker |
| `/v1` | `POST /v1/optimize` — full pipeline (server optimize) |

Migrations under `apps/api/src/services/storage/migrations/` (e.g. analytics sessions, license keys, platform roles).

---

## Optional / adjacent tools

| Path | Notes |
|------|--------|
| `extensions/browser-extension` | MV3 intercept for provider APIs; savings overlay (TOS risk documented) |
| `tools/proxy` | Enterprise OpenAI-compatible proxy toward Spectyra gateway |
| `infra/` | Deployment/infrastructure docs |

---

## Tech stack evaluation — LiteLLM & Langfuse

**Purpose:** Track two popular open-source projects to **evaluate later** whether they belong in Spectyra’s stack and **how** to integrate without duplicating our moat (local optimization, BYOK, canonical request model).

| Project | Repo | One-line role |
|---------|------|----------------|
| **LiteLLM** | [BerriAI/litellm](https://github.com/BerriAI/litellm) | Python SDK + **AI Gateway / proxy**: unified OpenAI-style API to **100+ LLM backends**, with routing, cost tracking, virtual keys, guardrails, logging; deployable as a central service. |
| **Langfuse** | [langfuse/langfuse](https://github.com/langfuse/langfuse) | **LLM engineering platform**: traces, observability, evals, prompt management, datasets, playground; self-hostable; integrates with OpenAI SDK, LangChain, **LiteLLM**, Vercel AI SDK, etc. |

### Why they might matter for Spectyra

- **LiteLLM** overlaps *conceptually* with “one gateway, many providers,” but Spectyra’s product is **optimization + policy + savings**, not provider routing alone. LiteLLM could still be useful as an **optional upstream/downstream** for teams that already run it, or as a **reference** for model-alias and multi-provider behavior—not a replacement for `@spectyra` optimizer logic.
- **Langfuse** overlaps with **analytics, sessions, and traces**. Spectyra already has normalized events, execution-graph summaries, and optional cloud sync. Langfuse could complement **deep trace UI / eval workflows** for power users, or stay **out of stack** if we keep analytics self-contained.

### Decision: **if** to add

Use this checklist when revisiting (product + eng):

| Question | LiteLLM | Langfuse |
|----------|---------|----------|
| Do we need it for **core** product, or only **enterprise / self-hosted** deployments? | Often **optional** unless we standardize on their proxy. | Often **optional** unless we want a full **trace/eval** product surface. |
| Does it **duplicate** what we already ship? | Partially (multi-provider gateway vs our API + adapters). | Partially (traces vs our event spine + analytics). |
| **Operational cost** (hosting, upgrades, security review)? | Medium — Python proxy, DB/config as per their docs. | Medium–high — full stack (see their Docker/K8s docs). |
| **Data residency / BYOK story** — does it fit “customer keys, minimal raw prompt retention”? | Configurable; review what passes through proxy. | Self-host possible; align retention with `docs/SPECTYRA_ARCHITECTURE.md`. |
| **License** — OK for our usage? | Review [LiteLLM license](https://github.com/BerriAI/litellm/blob/main/LICENSE) + enterprise features if needed. | OSS + `ee` folder — see [Langfuse LICENSE](https://github.com/langfuse/langfuse/blob/main/LICENSE). |

**Default stance until decided:** **Do not** block shipping on either; treat as **integrations or optional sidecars**, not core dependencies.

### Decision: **how** to add (options to explore)

**LiteLLM (if we adopt)**

1. **Sidecar / optional gateway** — Customer or we deploy LiteLLM; clients point OpenAI-compatible tools at LiteLLM → LiteLLM forwards to providers; Spectyra stays **before** or **after** that hop depending on architecture (document per deployment).
2. **Docs-only** — Document “Spectyra + LiteLLM” patterns for users who already use [LiteLLM proxy](https://docs.litellm.ai/docs/simple_proxy); no code dependency.
3. **Deep integration** — Only if we explicitly productize “Spectyra-managed LiteLLM” (high effort; revisit after demand).

**Langfuse (if we adopt)**

1. **Export / webhook** — Emit anonymized or allowlisted spans from our pipeline into Langfuse API (similar to existing analytics patterns).
2. **Parallel observability** — Power users self-host Langfuse; we document env vars and OpenTelemetry/SDK hooks if we add them.
3. **Replace internal analytics** — Only if we deliberately sunset parts of our trace UI (major product decision).

### Next steps (when someone picks this up)

- [ ] Read upstream README + license for each: [LiteLLM](https://github.com/BerriAI/litellm), [Langfuse](https://github.com/langfuse/langfuse).
- [ ] Map 1:1 against `docs/SPECTYRA_ARCHITECTURE.md`, and `apps/api` chat/agent routes.
- [ ] Prototype smallest integration: **docs** or **single optional env flag** path before any hard dependency.
- [ ] Record the **decision** (in this section or ADR): adopt / defer / reject, with date.

---

## Technical notes for contributors

- **Electron main:** Must not `require()` raw ESM from workspace packages; main/preload are bundled with **esbuild** (see `apps/desktop/scripts/build-electron.mjs`).
- **Angular:** Standalone components; guards: `authGuard`, `superuserGuard`.
- **Styling:** Global tokens in `apps/web/src/styles/spectyra-theme.scss`; Material overrides in `styles.scss` (light web vs `.desktop-app` dark).

---

## What is implemented vs not (snapshot)

| Area | Status |
|------|--------|
| Universal mode `off` / `observe` / `on` | Implemented across SDK, companion, desktop |
| Desktop + Live dashboard + companion SSE/polling | Implemented |
| Agent Companion wizard (steps, validation, handoff to Live) | **Implemented in UI** — polish and deeper runtimes continue |
| OpenClaw wizard page | **Implemented** — multi-provider assistants, architect, task boards **not** in scope yet |
| JSONL / ingest path for agentic tools | **Companion + adapters**; not a full “watch any log + task CRUD” product |
| **Named multi-agent registry, tasks per agent, architect-over-repo, provider matrix (Claude/OpenAI/Gemini) in one UX** | **Not implemented** (see TODO below) |
| **Agent fleet security + per-agent docs + composable skill workflows** | **Not implemented** beyond org policies, provider keys, and general docs |
| **Scenarios / Proof / Run pages in Angular** | **Components exist** — **routes not registered** in main app routes (verify before relying on them) |

---

## TODO / backlog (product & engineering)

These items capture known gaps and polish areas from product specs and repo evolution.

### High value / product completeness

1. **OpenClaw wizard** — Deeper flows (new vs existing user paths, copy config, open folders, troubleshooting) aligned with `docs/SPECTYRA_ARCHITECTURE.md`.
2. **Agent Companion** — Parity for **Gemini** and other runtimes where copy is still generic; guided **JSONL path picker** + validation that ingest is receiving events.
3. **Generic runtimes** — First-class UX for attaching logs/JSONL (sidecar script template, folder watch) beyond static instructions.
4. **Trial / license UX** — End-to-end: trial badge, post-trial observe/projected savings, clear “actual vs projected” labels, optimization toggle behavior without breaking workflows.
5. **Monitoring vs optimization** — Always-on monitoring messaging; optimization optional; projected metrics when optimization is off.

### Desktop / companion polish

6. **Parity** — Sessions, History, Compare, Security pages at parity with Live for layout, empty states, and badges.
7. **Helpers** — Open config/data dirs, detect paths, validation pipeline, troubleshooting surfaces.
8. **Orphan routes** — Decide whether to wire **Scenarios / Proof / Run** pages into `app.routes.web.ts` or remove dead code.

### Web / API

9. **Superuser / platform roles** — Keep aligned with migrations (`010_platform_roles.sql` etc.) and UI guards.
10. **Analytics / sessions** — Cloud sync and session storage behavior as documented in API routes.

### Documentation

11. Keep **`spectyra-brand.md`** in sync with `spectyra-theme.scss` when tokens change.
12. Optional: link this file from `README.md` for onboarding.
13. **LiteLLM / Langfuse stack evaluation** — See **Tech stack evaluation — LiteLLM & Langfuse** (earlier in this file); update checkboxes and decision date when evaluated.

---

## TODO — Desktop, OpenClaw, agentic coding & full agent lifecycle (**largely not built**)

**Context:** Continue investing in the **desktop app** and **Local Companion** as the hub for setup and monitoring. The **OpenClaw** and **agentic AI coding** wizards should grow toward end-to-end setup for **Claude, OpenAI, Gemini**, and similar providers, with users able to launch different **assistants** or **coding team members**. Today, Spectyra focuses on **optimization + local analytics** (sessions, events, summaries) and **setup wizards**; it does **not** yet deliver a unified **control plane** for creating many named agents, assigning/removing tasks, or an **architect** role over an entire repo with a single task board.

Use this list when starting a new chat; implementation should **reuse** ingest + event adapters, Live/session models, Agent Companion state, and `docs/SPECTYRA_ARCHITECTURE.md`; add **local persistence** (e.g. under `~/.spectyra/desktop/`) for agent/task registry if not cloud-backed.

### Priority themes

1. **Desktop / Local Companion as hub** — Single place to **configure, launch, and watch** OpenClaw-style and agentic coding stacks, not only docs + Live view.

2. **OpenClaw wizard + agentic coding wizard** — End-to-end setup (env, base URL, companion, ingest, validation); clear paths for **OpenClaw AI assistant** and **agentic coding** flows.

3. **Multi-provider assistants** — Let users pick **Claude / OpenAI / Gemini / others** per profile; launch different **AI assistants** or **coding team members**; persist profiles locally (optional cloud metadata sync).

4. **“Architect” agent** — A mode or agent that **watches the whole codebase** (or chosen roots) with explicit **security and scope** boundaries.

5. **Agent registry & live ops** — Surface **all defined agents**, **which are running**, **tasks** in progress, and **activity** from **OpenClaw / agentic logs** (e.g. **JSONL** tail, `events/recent`, ingest), with a usable **log/trace viewer** in the desktop app.

6. **Task management per agent** — **Create tasks** under each agent, **track progress**, **watch** execution, **add/remove** tasks, correlate with **sessions/events** from the companion.

7. **Security & documentation per agent/workflow** — Per-agent or per-workflow **security** (scopes, tools, data boundaries) and **documentation** of what each integration allows — in UI, not only static markdown.

8. **Identity & skills** — **Names**, **titles**, **capabilities** (“what they know how to do”), attachable **skills** or templates, **reusable skill bundles** for new agents.

9. **Composable workflows** — **Full workflows** (e.g. plan → implement → review) with **skills** attachable to steps and to new agents; easy **create → launch → watch → assign skills/tasks → iterate**.

10. **North star** — **Simple, opinionated** management of **agentic AI assistants** and **agentic coders** from the **desktop + Local Companion** experience, with **everything watchable** from one place.

---

## How to use this file in a new chat

Paste or @-mention `APP_CURRENT_STATUS_AND_TODO.md` and state your goal (e.g. “extend Agent Companion wizard step 3” or “design agent registry schema”). For UI work, also reference `spectyra-brand.md` and the relevant route files under `apps/web/src/app/app.routes.*.ts`.
