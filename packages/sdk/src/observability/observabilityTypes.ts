import type { SavingsReport } from "@spectyra/core-types";

/**
 * @public
 * Plan label for quota / UI (aligned with Spectyra billing where possible).
 */
export type SpectyraDashboardPlan = "free" | "starter" | "pro" | "enterprise";

/**
 * @public
 * Coarse state for in-app displays and hooks (aligned with product spec + server signals).
 */
export type SpectyraQuotaState =
  | "missing_api_key"
  | "invalid_api_key"
  | "active_paid"
  | "active_free"
  | "approaching_limit"
  | "quota_exhausted"
  | "inactive_due_to_quota"
  | "payment_failed"
  | "subscription_inactive"
  | "account_paused"
  | "account_deleted"
  | "disabled";

/**
 * @public
 * Quota and plan snapshot for the SDK (hooks, overlay, getters).
 */
export interface SpectyraQuotaStatus {
  plan: SpectyraDashboardPlan;
  state: SpectyraQuotaState;
  used: number;
  limit: number | null;
  remaining: number | null;
  percentUsed: number | null;
  /** Same-origin or absolute dashboard URL for upgrades when the backend supplies it. */
  upgradeUrl?: string;
  /** True when the server would not accrue/apply paid savings semantics (billing / org observe-only override). */
  savingsObserveOnly?: boolean;
  /** When false, the SDK should not apply optimizations (local passthrough / run off). */
  canRunOptimized: boolean;
  /** Short human line for overlay / managers (no “observe mode” wording for `productSurface: "in_app"`). */
  detail?: string;
}

/**
 * @public
 * High-level account entitlements the SDK can show after a refresh.
 */
export interface SpectyraEntitlementStatus {
  quota: SpectyraQuotaStatus;
  lastRefreshedAt: string | null;
  /** Set when a refresh could not be completed. */
  lastError?: string;
  /** Correlation: server org id or undefined when unknown. */
  orgId?: string;
}

/**
 * @public
 * Cumulative in-process metrics (non-persistent) for a Spectyra instance.
 */
export interface SpectyraMetricsSnapshot {
  requestCount: number;
  totalEstimatedSavingsUsd: number;
  totalInputTokensBefore: number;
  totalInputTokensAfter: number;
  averageSavingsPct: number;
  lastRequestAt: string | null;
  optimizationPaused: boolean;
}

/**
 * @public
 * Shorthand savings summary (manager / proof of value).
 */
export interface SpectyraSavingsSummary {
  requestCount: number;
  totalEstimatedSavingsUsd: number;
  averageSavingsPct: number;
  optimizationPaused: boolean;
}

/**
 * @public
 * Session-level cost rollups (in-process, same instance as {@link createSpectyra}).
 */
export interface SpectyraSessionCostSummary {
  requestCount: number;
  totalCostBeforeUsd: number;
  totalCostAfterUsd: number;
  totalSavingsUsd: number;
  averageSavingsPct: number;
  optimizationPaused: boolean;
}

/**
 * @public
 * A single `complete()` run for `getLastRun` / overlay.
 */
export interface SpectyraLastRun {
  at: string;
  provider: string;
  model: string;
  report: Pick<
    SavingsReport,
    | "inputTokensBefore"
    | "inputTokensAfter"
    | "outputTokens"
    | "estimatedCostBefore"
    | "estimatedCostAfter"
    | "estimatedSavings"
    | "estimatedSavingsPct"
    | "transformsApplied"
  >;
}
