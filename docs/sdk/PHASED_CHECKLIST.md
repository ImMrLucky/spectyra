# Phased implementation checklist (full spec)

Work **in phase order**. Within a phase, items are roughly dependency-ordered. Update checkboxes as you land changes. OpenClaw packages (`tools/local-companion`, `openclaw-skill`, `openclaw-bridge`) stay **out of scope** unless a line explicitly says “compatibility only”.

**Legend:** `[ ]` todo · `[~]` in progress · `[x]` done

---

## Phase 0 — Baseline & docs

- [x] Repo `docs/sdk/README.md` (integration modes).
- [x] Repo `docs/sdk/SPEC_CHECKLIST.md` (granular feature matrix).
- [x] This file `docs/sdk/PHASED_CHECKLIST.md` (ordered delivery).
- [x] OpenClaw / companion regression smoke: **CI** `.github/workflows/sdk-openclaw-smoke.yml` (bridge tests + companion test + bundle). Optional human log in `SPEC_CHECKLIST.md` section A after manual runs.

---

## Phase 1 — `@spectyra/sdk` contracts (types, entitlements, quota)

- [x] Expand `SpectyraQuotaState` for all spec **blocked / account** states (`packages/sdk/src/observability/observabilityTypes.ts`).
- [x] Optional `SpectyraQuotaStatus.detail` / human copy for overlay (`observabilityTypes.ts` + mapper + devtools).
- [x] API `GET /v1/entitlements/status` includes `subscriptionStatus` for mapping (`apps/api/src/routes/entitlements.ts`).
- [x] `EntitlementsStatusPayload` + `mapToSpectyraEntitlementStatus` map subscription + quota priority (`mapEntitlementStatus.ts`).
- [x] `EntitlementHttpError` + refresh path maps **401 → `invalid_api_key`**, **403 → `disabled`** (`fetchEntitlementStatus.ts`, `entitlementRuntime.ts`).
- [x] `shouldFreezeFromQuota` treats non-active optimization states as frozen (`entitlementRuntime.ts`).
- [x] `missing_api_key` synthetic state when cloud key/base URL absent while entitlements are enabled (`entitlementRuntime.ts`).
- [x] `account_deleted`: `orgLifecycleStatus` on `GET /v1/entitlements/status` + mapper priority; HTTP **404/410** on refresh maps to the same state (`mapEntitlementStatus.ts`, `entitlementRuntime.ts`).

---

## Phase 2 — Pricing & savings fidelity

- [x] `CostBreakdown.source`: TS calculator sets `provider_usage_plus_registry` when `rawProviderUsage` present, else `registry_only` (`costCalculator.ts`).
- [x] Rust `CostBreakdown.source` uses the same two literals when `raw_provider_usage` is set (`runtime/core-rust/.../cost_calculator.rs`).
- [x] `manual_override` / `fallback_estimate` via `costSourceOverride` + empty-line fallback (TS + Rust `NormalizedUsage`).
- [x] DB-backed `ProviderPricingSnapshot` + overrides + admin editor (**Phase 6** — see below).

---

## Phase 3 — In-app product vs “observe” naming (no behavior break for OpenClaw)

- [x] `SpectyraConfig.productSurface?: "in_app" | "openclaw_compat"` (`types.ts`) — default `in_app`.
- [x] Devtools copy: billing/entitlement pause wording, not “observe mode”, when `productSurface === "in_app"` (`devtools/mountDevtools.ts`).
- [x] `localWrapper` / license: narrow license-limited notes via `productSurface` (`openclaw_compat` vs `in_app`).

---

## Phase 4 — Observability & devtools

- [x] Logger / metrics / emitters file layout (`logging/logger.ts`, `metrics/savingsAggregator.ts`, `events/emitters.ts`).
- [x] Overlay: pricing snapshot age row + “Pricing details” subsection (`mountDevtools.ts` + `getPricingSnapshotMeta`).
- [x] Hooks: `onQuota` / `onPricingStale` on `complete` when passthrough or metrics frozen / when pricing meta is stale (`createSpectyra.ts`).

---

## Phase 5 — Rust, FFI, CI

- [x] `spectyra_run_chat_pipeline_json` + `PipelineOutput` serde.
- [x] `spectyra_optimize_json` alias (spec name) → same pipeline (`spectyra-ffi`).
- [x] FFI unit tests (savings + pipeline).
- [x] GitHub Action: `cargo build` + `cargo test` for `runtime/` (`.github/workflows/runtime-rust.yml`).
- [x] Version / publish policy: `docs/sdk/PUBLISHING.md`.

---

## Phase 6 — Backend pricing service (persisted)

- [x] Postgres tables + startup DDL: `pricing_registry_snapshots`, `pricing_registry_overrides` (`ensurePricingRegistrySchema.ts`, `migrations/007_pricing_registry.sql`).
- [x] Job / ingest: `pnpm --filter api run pricing:ingest-bundled` + `.github/workflows/pricing-registry-refresh.yml` (weekly + `workflow_dispatch`; requires `DATABASE_URL` secret) + owner **Ingest bundled** in admin UI.
- [x] `GET /v1/pricing/model` (+ machine auth) (`apps/api/src/routes/pricing.ts`).
- [x] Admin UI + API: overrides CRUD, stale banner, `GET /v1/admin/pricing/status` for operator alert on admin home (`apps/web`, `apps/api`).

---

## Phase 7 — Multi-language SDKs (`sdks/`)

- [x] Python / Java / .NET / Go scaffolds (runtime HTTP + docs for embedded).
- [x] Publish-ready CI: `.github/workflows/sdks-ci-publish.yml` (build/test matrix; wire PyPI/Maven/NuGet/pkg.go.dev tokens when publishing for real — see `PUBLISHING.md`).
- [x] Embedded paths: Java **JNA** (`SpectyraNative`), .NET **`NativeLibrary` + P/Invoke** (`SpectyraFfi` + `SpectyraSession` facade), Go **linux/amd64 + CGO dlopen** (`RunChatPipelineFFIJSON(libPath, input)` + `Session`) + stub for other platforms.

---

## Phase 8 — Privacy & compliance tests

- [x] SDK telemetry test: no secret echo + banned keys (`telemetryPrivacy.test.ts`).
- [x] Rust: telemetry DTO JSON excludes message-like keys (`runtime/core-rust/src/telemetry/mod.rs` tests).
- [x] FFI: envelope does not echo API-key-like strings (`spectyra-ffi` tests).

---

## Phase 9 — Acceptance gate

- [x] All Phase 0–8 boxes above `[x]`.
- [x] `SPEC_CHECKLIST.md` acceptance table all `[x]`.
- [x] Release notes: `docs/sdk/RELEASE_NOTES_QUOTA_STATES.md`.

_Last updated: 2026-04-23_
