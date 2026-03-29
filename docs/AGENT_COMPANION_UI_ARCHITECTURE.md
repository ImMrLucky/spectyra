# Agent Companion UI — architecture (desktop + web)

This document maps the **Agent Companion / Live monitoring** product layer: routes, Angular components, services, event adapters, and completion status versus the product spec.

## Route map (Electron desktop)

| Path | Screen |
|------|--------|
| `/desktop/live` | **Hero** — split Agent activity / Spectyra intelligence + lower tabs |
| `/desktop/live-savings` | Redirect → `/desktop/live` |
| `/desktop/sessions` | Session list + badges |
| `/desktop/history` | Roll-up KPIs (today / week) |
| `/desktop/compare` | Compare hub → Live prompt compare |
| `/desktop/agent-companion` | Landing — setup vs attach |
| `/desktop/openclaw` | OpenClaw wizard (phases A–F) |
| `/desktop/security` | Trust cards |
| `/desktop/settings` | Shell → onboarding / integrations |
| `/desktop/dashboard` | Legacy summary |
| `/desktop/onboarding` | Provider / companion setup |
| `/desktop/runs` | Run history |
| `/desktop/live-legacy` | Previous detailed “Live savings” grid (bookmarks) |

Default route: **`/desktop/live`**.

## Angular component tree (implemented)

```
features/desktop/live/
  live.page.ts              — split layout, SSE, sync
  live-top-bar.component.ts — Spectyra Active, trial, mode, actual vs projected
  agent-activity-panel.component.ts
  spectyra-intelligence-panel.component.ts
features/desktop/openclaw/
  openclaw.page.html        — accordion wizard
openclaw.page.ts
```

## Services (`app/core/agent-companion/`)

| Service | Role |
|---------|------|
| `TrialLicenseUiService` | Topline labels: trial badge (localStorage `spectyra.local_trial_ends_at`), **Actual** vs **Projected** metrics |
| `LiveSessionService` | One-shot fetch of health + live-state + sessions + moat summaries |
| `CompanionEventStreamService` | SSE wrapper (`/v1/analytics/live-events`) |

`CompanionAnalyticsService` remains the HTTP client for the Local Companion.

## Local Companion `/health` (license + monitoring)

Adds:

- `licenseKeyPresent`, `licenseAllowsFullOptimization` (via `activateLicense`)
- `monitoringEnabled` — `telemetryMode !== "off"`

## Event adapters (`@spectyra/event-adapters`)

Existing adapters: SDK, Local Companion, OpenClaw JSONL, Claude hooks/JSONL, OpenAI tracing, generic JSONL.

**New:** `source-labels.ts` — `EVENT_SOURCE_LABELS`, `labelForIntegration()` for consistent UI copy.

## Spec phases — status

| Phase | Topic | Status |
|-------|--------|--------|
| 1 | Routes, shell, service map | **Done** (this doc + code) |
| 2 | Live SSE + adapters | **Partial** — SSE wired; full attach flows use existing ingestion tests |
| 3 | Live split dashboard | **Done** — two columns + tabs |
| 4 | Agent Companion + OpenClaw wizard | **Done** (landing + accordion wizard) |
| 5 | Generic runtime wizard | **Stub** — covered by Agent Companion copy + onboarding; dedicated multi-runtime stepper can extend |
| 6 | Sessions / History / Compare / Security | **Shells** — History aggregates locally; charts TBD |
| 7 | Polish | Ongoing |

## Trial / 7-day UX

- **Optimization ON** when `runMode === 'on'` and `licenseAllowsFullOptimization`.
- **Projected** savings when not licensed or in `observe` — UI uses `TrialLicenseUiService.computeTopline()`.
- Optional **Trial Active** badge when `localStorage['spectyra.local_trial_ends_at']` is a future ISO date (set from Desktop/onboarding when org trial is wired).

## Next steps (engineering)

1. Wire `spectyra.local_trial_ends_at` from Supabase org `trial_ends_at` when signed in on desktop.
2. History: charts (cost / time / steps) from session list or cloud API.
3. Generic runtime wizard: `mat-stepper` reusing validation checklist pattern from OpenClaw.
4. Toolbar: reduce link count or overflow menu on small windows.
