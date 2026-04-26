# Spectyra in-app SDK & multi-language — implementation checklist

**Phased delivery order:** see [PHASED_CHECKLIST.md](./PHASED_CHECKLIST.md) (execute phases 0 → 9, then close items here).

This checklist tracks the product spec (OpenClaw packages **out of scope** here). Update dates and boxes as work lands.

**Legend:** `[x]` done · `[~]` partial · `[ ]` not started

---

## A. OpenClaw isolation (constraint)

- [x] No intentional refactor of `@spectyra/local-companion`, `packages/openclaw-skill`, `packages/openclaw-bridge` as part of SDK spec work.
- [x] Regression smoke: **CI** `.github/workflows/sdk-openclaw-smoke.yml` (OpenClaw bridge + local companion). _Optional manual log:_ **Date:** … **Result:** pass \| fail **Notes:** …

---

## B. `@spectyra/sdk` (Node / TypeScript)

### B1. Public API layers

- [x] Layer 1 — `createSpectyra({ apiKey, provider, … })` (see `createSpectyra.ts`, `types.ts`; `apiKey` via cloud key resolver).
- [x] Layer 2 — `debug`, `logLevel`, `logger` on config (`SpectyraLogLevel`, `createSpectyraLogger`).
- [x] Layer 3 — hooks: `onRequestStart`, `onRequestEnd`, `onOptimization`, `onMetrics`, `onQuota`, `onEntitlementChange`, `onCostCalculated`, `onPricingStale` (including `onQuota` / `onPricingStale` on `complete` when frozen or stale pricing).
- [x] Layer 4 — `devtools` + `mountSpectyraDevtools` (`devtools/mountDevtools.ts`).

### B2. Runtime getters

- [x] `getSessionStats`, `getSavingsSummary`, `getQuotaStatus`, `getLastRun`, `getLastRunCostBreakdown`, `getLastRunSavings`, `getSessionCostSummary`, `getPricingSnapshotMeta` (session state + pricing runtime).

### B3. Entitlements & quota (no redeploy)

- [x] Dynamic `GET /v1/entitlements/status` polling (`entitlements/entitlementRuntime.ts`, config `entitlements`).
- [x] Quota exhausted → passthrough provider, freeze metrics (`SpectyraSessionState.metricsFrozen`, `shouldPassthroughFromEntitlement`).
- [x] Copy audit: blocked states (`payment_failed`, `subscription_inactive`, `account_paused`, `invalid_api_key`, `missing_api_key`, `account_deleted`, …) mapped in `mapEntitlementStatus` + devtools (`subscriptionStatus`, `orgLifecycleStatus` on API; HTTP 401/403/404/410 in refresh).

### B4. Pricing & savings (hybrid model)

- [x] Types + client + runtime cache (`packages/sdk/src/pricing/*`).
- [x] API `GET /v1/pricing/snapshot` (machine key) + bundled registry (`apps/api`).
- [x] Rust core + local-runtime refresh aligned with snapshot JSON (`runtime/core-rust`, `pricing_refresh.rs`).
- [x] TS `calculateCostFromEntry` batch multipliers: input vs output lines (parity with Rust).
- [x] `SavingsCalculation` / `CostBreakdown.source`: `provider_usage_plus_registry`, `registry_only`, `manual_override`, `fallback_estimate` (TS + Rust `costSourceOverride` + empty-line fallback).
- [x] Admin / machine routes prefer latest `pricing_registry_snapshots`; overrides merge per org; bundled fallback (see **F**).

### B5. Observability modules (file layout)

- [x] Structured logging — `observability/spectyraLogger.ts` (checklist “logger.ts” satisfied via re-export in `logging/logger.ts`).
- [x] Session metrics — `observability/spectyraSessionState.ts` + `metrics/savingsAggregator.ts` (`getSavingsSummaryFromSession`, `getSessionCostSummaryFromSession`).
- [x] `events/emitters.ts` — re-export hub (`./events/emitters.js`) for spec path parity.

### B6. Product copy: “no observe mode” (in-app SDK)

- [x] `SpectyraConfig.productSurface` + devtools billing-first copy (`mountDevtools.ts`) + `localWrapper` license-limited notes keyed off `productSurface`.

### B7. Docs & examples

- [x] `docs/sdk/README.md` — integration modes.
- [x] `packages/sdk/README.md` — links + dev vs production examples (see “Development vs production”).

---

## C. Rust shared engine & FFI

- [x] `runtime/core-rust` — pipeline, pricing, quota, models, telemetry types.
- [x] `runtime/local-runtime` — HTTP API (`/v1/chat/run`, pricing meta, entitlement refresh).
- [x] `runtime/spectyra-ffi` — `spectyra_calculate_savings_json`, `spectyra_version`, `spectyra_free_string`.
- [x] `spectyra_run_chat_pipeline_json` — optimize messages in-process (JSON in/out) for embedded SDKs.
- [x] FFI unit tests — savings JSON shape; pipeline JSON round-trip; no API-key echo in pipeline envelope; SDK / Rust telemetry privacy tests.
- [x] `spectyra_optimize_json` — alias of `spectyra_run_chat_pipeline_json` (`spectyra-ffi`).
- [x] CI: `.github/workflows/runtime-rust.yml` runs `cargo build` + `cargo test` on `runtime/`.

---

## D. Multi-language SDKs (`sdks/`)

| SDK | Manifest | README | Embedded (FFI) | Runtime HTTP | `runChat` / equivalent |
|-----|----------|--------|----------------|----------------|-------------------------|
| Python | `sdks/python/pyproject.toml` | [x] | [x] ctypes (`SPECTYRA_FFI_PATH`) | [x] | [x] |
| Java | `sdks/java/pom.xml` | [x] | [x] JNA (`SpectyraNative` + `SPECTYRA_FFI_PATH`) | [x] | [x] `runChatRuntimeRaw` |
| .NET | `sdks/dotnet/Spectyra.SDK.csproj` | [x] | [x] `NativeLibrary` (`SpectyraFfi`) + `SpectyraSession` facade | [x] | [x] `RunChatRuntimeAsync` |
| Go | `sdks/go/go.mod` | [x] | [x] linux/amd64 CGO dlopen (`RunChatPipelineFFIJSON(libPath, input)`); stub elsewhere | [x] | [x] `RunChatRuntime`, `Session` facade |

- [x] Publish-ready CI: `.github/workflows/sdks-ci-publish.yml` (build/test matrix; registry tokens per `PUBLISHING.md`).
- [x] `clients/*/README.md` — kept as lightweight pointers; canonical layout is `sdks/`.

---

## E. Web app (control plane)

- [x] Billing / plan / usage pages exist (`apps/web` billing, usage, analytics).
- [x] Admin pricing (`/admin/pricing`): catalog + ingest + overrides + `{ snapshot, registry }`.
- [x] Manual pricing overrides UI + API (`PUT`/`DELETE` `/v1/admin/pricing/overrides`).
- [x] Stale snapshot alerting: pricing page banner + admin home banner via `GET /v1/admin/pricing/status`.

---

## F. Backend pricing service (longer horizon)

- [x] Bundled snapshot + version string.
- [x] Postgres: `pricing_registry_snapshots` + `pricing_registry_overrides` (startup DDL + `007_pricing_registry.sql`); resolver prefers latest snapshot JSON; per-org override merge on machine routes.
- [x] Scheduled / manual ingest: `pricing:ingest-bundled` script + GitHub workflow `pricing-registry-refresh.yml`.
- [x] `GET /v1/pricing/model?provider=&model=` (machine auth).

---

## G. Privacy & BYOK

- [x] `docs/privacy/byok-and-local-architecture.md` (runtime docs).
- [x] Automated tests: SDK `telemetryPrivacy.test.ts` asserts no secret echo + banned keys; Rust `sdk_payload_json_excludes_forbidden_keys` in `core-rust` telemetry module; FFI pipeline envelope test.

---

## Acceptance summary

| Criterion | Status |
|-----------|--------|
| OpenClaw packages unchanged by SDK work | [x] constraint |
| SDK observability (logs, hooks, overlay, getters) | [x] |
| Free → paid without redeploy | [x] entitlement refresh + quota hooks on `complete` |
| Savings from registry + usage (not tokens only) | [x] |
| Multi-language SDK repos present with `runChat` + modes | [x] |
| Rust single algorithm core + FFI | [x] |

_Last updated: 2026-04-23_
