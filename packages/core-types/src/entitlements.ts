/**
 * Entitlement and licensing model.
 *
 * Used by the SDK, Desktop App, and Website App to determine
 * what Spectyra features a customer can access.
 *
 * Provider usage is NEVER blocked by Spectyra license state.
 * Only Spectyra optimization features degrade.
 */

export type PlanType = "free" | "starter" | "pro" | "enterprise";
export type TrialState = "active" | "expired" | "converted";
export type LicenseStatus = "valid" | "expired" | "revoked" | "missing";

export interface EntitlementInfo {
  plan: PlanType;
  trialState: TrialState | null;
  trialEndsAt: string | null;
  licenseStatus: LicenseStatus;

  /** Max optimized (mode=on) runs per billing period, null = unlimited */
  optimizedRunsLimit: number | null;
  optimizedRunsUsed: number;

  /** Whether cloud analytics sync is available on this plan */
  cloudAnalyticsEnabled: boolean;

  /** Whether desktop app is available on this plan */
  desktopAppEnabled: boolean;

  /** Whether SDK integration is available on this plan */
  sdkEnabled: boolean;
}

/**
 * Free-tier defaults: observe is always free, on has a generous allowance.
 */
export const FREE_TIER_DEFAULTS: Readonly<EntitlementInfo> = {
  plan: "free",
  trialState: null,
  trialEndsAt: null,
  licenseStatus: "valid",
  optimizedRunsLimit: 100,
  optimizedRunsUsed: 0,
  cloudAnalyticsEnabled: false,
  desktopAppEnabled: true,
  sdkEnabled: true,
} as const;
