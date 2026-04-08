/**
 * UI-specific types
 * Types used only in web UI components
 */

/**
 * Billing Status - Full version
 * Used by apps/web/src/app/features/billing/billing.page.ts
 */
/** High-level state for dashboard / SDK copy */
export type BillingState =
  | "trial"
  | "active"
  | "canceling"
  | "paused"
  | "inactive";

export interface BillingStatus {
  org: {
    id: string;
    name: string;
  };
  /** Savings optimization (mode=on) allowed */
  has_access: boolean;
  /** Same as has_access — explicit for clients */
  savings_active: boolean;
  trial_ends_at: string | null;
  trial_active: boolean;
  subscription_status: string;
  subscription_active: boolean;
  stripe_subscription_id: string | null;
  subscription_current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** When savings access ends (trial end or end of paid period) */
  entitlement_ends_at: string | null;
  days_remaining: number | null;
  billing_state: BillingState;
  /** Short message for SDK / desktop banners */
  status_message: string;
}

/**
 * Billing Status - Partial version
 * Used by apps/web/src/app/features/usage/usage.page.ts
 */
export interface BillingStatusPartial {
  subscription_active?: boolean;
  subscription_status?: string;
  trial_ends_at?: string | null;
  /** From GET /v1/billing/status when using JWT */
  org_platform_exempt?: boolean;
  has_access?: boolean;
  /** True when trial ended / unpaid (or superuser forced) — no accruing “real” savings. */
  observe_only_savings?: boolean;
  observe_only_override?: boolean | null;
  savings_active?: boolean;
  entitlement_ends_at?: string | null;
  days_remaining?: number | null;
  billing_state?: BillingState;
  cancel_at_period_end?: boolean;
  subscription_current_period_end?: string | null;
  status_message?: string;
}

/**
 * Optimization Level
 * Used by both API and web
 */
export type OptimizationLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Optimization Savings
 * Used by web UI components
 */
export interface OptimizationSavings {
  optimization: string;
  name: string;
  tokens_saved: number;
  runs_count: number;
}
