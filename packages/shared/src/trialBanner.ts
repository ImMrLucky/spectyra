/**
 * Shared billing / upgrade messaging for web, desktop, and CLI.
 * Driven from server fields (`trial_ends_at`, `subscription_status`) + optional `has_access`.
 */

export type TrialBannerSeverity = "none" | "info" | "reminder" | "urgent" | "expired";

export interface TrialBannerState {
  severity: TrialBannerSeverity;
  /** Whole days left before access window end (ceil); null if unknown */
  daysRemaining: number | null;
  trialEndsAt: Date | null;
  /** Short line for banners / CLI */
  title: string;
  /** Longer line for tooltips / companion */
  detail: string;
  /** Whether to show a primary “Upgrade” / “Billing” action */
  showUpgradeCta: boolean;
}

export interface TrialBannerStateInput {
  trialEndsAtIso: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  /** True when Stripe subscription is active (paid). */
  subscriptionActive?: boolean | null;
  /** Superuser / comp org — no upgrade messaging. */
  platformExempt?: boolean | null;
  /** From API: savings in Observe-only until paid tier. */
  observeOnlySavings?: boolean | null;
  now?: Date;
  /** Default 7: above this is informational only */
  reminderDays?: number;
  /** Default 3: at or below this is urgent */
  urgentDays?: number;
  /** Product name in copy */
  productName?: string;
}

function safeDate(iso: string | null | undefined): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Compute consistent upgrade banner state from org billing fields.
 * Legacy orgs may still have `subscription_status === "trial"` and `trial_ends_at`.
 */
export function trialBannerState(input: TrialBannerStateInput): TrialBannerState {
  const now = input.now ?? new Date();
  const product = input.productName?.trim() || "Spectyra";
  const reminderDays = input.reminderDays ?? 7;
  const urgentDays = input.urgentDays ?? 3;

  const paidStripe = input.subscriptionActive === true;
  if (paidStripe || input.platformExempt === true) {
    return {
      severity: "none",
      daysRemaining: null,
      trialEndsAt: null,
      title: "",
      detail: "",
      showUpgradeCta: false,
    };
  }

  /** DB `active` without a Stripe sub = included usage tier — no upgrade banner. */
  if (
    input.subscriptionStatus === "active" &&
    input.subscriptionActive !== true &&
    input.observeOnlySavings !== true
  ) {
    return {
      severity: "none",
      daysRemaining: null,
      trialEndsAt: null,
      title: "",
      detail: "",
      showUpgradeCta: false,
    };
  }

  if (input.observeOnlySavings === true) {
    const end = safeDate(input.trialEndsAtIso);
    return {
      severity: "expired",
      daysRemaining: 0,
      trialEndsAt: end,
      title: "Observe only",
      detail: `Your plan is in Observe mode: you can keep using ${product}, but savings stay projected until you add a paid tier.`,
      showUpgradeCta: true,
    };
  }

  const end = safeDate(input.trialEndsAtIso);
  if (!end) {
    return {
      severity: "info",
      daysRemaining: null,
      trialEndsAt: null,
      title: `${product} workspace`,
      detail: `Use included optimized tokens, then pick Developer Pro, Team Pro, or Enterprise when you need more.`,
      showUpgradeCta: true,
    };
  }

  const msLeft = end.getTime() - now.getTime();
  const daysRemaining = Math.ceil(msLeft / 86400000);

  if (msLeft <= 0) {
    return {
      severity: "expired",
      daysRemaining: 0,
      trialEndsAt: end,
      title: "Upgrade required",
      detail: `Included access for this ${product} workspace has ended. Open Billing to choose a paid tier.`,
      showUpgradeCta: true,
    };
  }

  const showUpgradeCta = input.subscriptionStatus === "trial" || input.subscriptionStatus === "past_due";

  if (daysRemaining > reminderDays) {
    return {
      severity: "info",
      daysRemaining,
      trialEndsAt: end,
      title: "Included access active",
      detail: `${daysRemaining} days left on your current access window (ends ${end.toLocaleDateString()}).`,
      showUpgradeCta,
    };
  }

  if (daysRemaining > urgentDays) {
    return {
      severity: "reminder",
      daysRemaining,
      trialEndsAt: end,
      title: "Access window ending soon",
      detail: `${daysRemaining} days left — open Billing before ${end.toLocaleDateString()} to avoid interruption.`,
      showUpgradeCta: true,
    };
  }

  return {
    severity: "urgent",
    daysRemaining,
    trialEndsAt: end,
    title: daysRemaining <= 1 ? "Access ends soon" : "Last days of included access",
    detail:
      daysRemaining <= 1
        ? `Your included access ends ${end.toLocaleDateString()}. Choose a plan on Billing.`
        : `${daysRemaining} days left before your access window ends. Open Billing to continue.`,
    showUpgradeCta: true,
  };
}
