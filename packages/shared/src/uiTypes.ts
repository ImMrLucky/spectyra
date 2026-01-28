/**
 * UI-specific types
 * Types used only in web UI components
 */

/**
 * Billing Status - Full version
 * Used by apps/web/src/app/features/billing/billing.page.ts
 */
export interface BillingStatus {
  org: {
    id: string;
    name: string;
  };
  has_access: boolean;
  trial_ends_at: string | null;
  trial_active: boolean;
  subscription_status: string;
  subscription_active: boolean;
}

/**
 * Billing Status - Partial version
 * Used by apps/web/src/app/features/usage/usage.page.ts
 */
export interface BillingStatusPartial {
  subscription_active?: boolean;
  subscription_status?: string;
  trial_ends_at?: string | null;
  has_access?: boolean;
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
