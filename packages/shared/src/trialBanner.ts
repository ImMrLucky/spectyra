/**
 * Shared trial / upgrade messaging for web, desktop, and CLI.
 * Drive only from server fields (`trial_ends_at`, `subscription_status`) + optional `has_access`.
 */

export type TrialBannerSeverity = "none" | "info" | "reminder" | "urgent" | "expired";

export interface TrialBannerState {
  severity: TrialBannerSeverity;
  /** Whole days left before trial end (ceil); null if unknown */
  daysRemaining: number | null;
  trialEndsAt: Date | null;
  /** Short line for banners / CLI */
  title: string;
  /** Longer line for tooltips / companion */
  detail: string;
  /** Whether to show a primary “Upgrade” / “Subscribe” action */
  showUpgradeCta: boolean;
}

export interface TrialBannerStateInput {
  trialEndsAtIso: string | null | undefined;
  subscriptionStatus: string | null | undefined;
  /** True when Stripe subscription is active (paid). */
  subscriptionActive?: boolean | null;
  /** Superuser / comp org — no upgrade messaging. */
  platformExempt?: boolean | null;
  /** From API: trial ended / unpaid — real savings off; Observe-only until subscribe. */
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
 * Compute consistent trial banner state from org billing fields.
 */
export function trialBannerState(input: TrialBannerStateInput): TrialBannerState {
  const now = input.now ?? new Date();
  const product = input.productName?.trim() || "Spectyra";
  const reminderDays = input.reminderDays ?? 7;
  const urgentDays = input.urgentDays ?? 3;

  const paid =
    input.subscriptionStatus === "active" ||
    input.subscriptionActive === true ||
    input.platformExempt === true;

  if (paid) {
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
      detail: `Your plan is in Observe mode: you can keep using ${product}, but savings stay projected until you subscribe.`,
      showUpgradeCta: true,
    };
  }

  const end = safeDate(input.trialEndsAtIso);
  if (!end) {
    return {
      severity: "info",
      daysRemaining: null,
      trialEndsAt: null,
      title: `${product} trial`,
      detail: `Start using ${product}; subscribe when you are ready.`,
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
      title: "Trial ended",
      detail: `Your ${product} trial has ended. Subscribe to keep full access.`,
      showUpgradeCta: true,
    };
  }

  const showUpgradeCta = input.subscriptionStatus === "trial" || input.subscriptionStatus === "past_due";

  if (daysRemaining > reminderDays) {
    return {
      severity: "info",
      daysRemaining,
      trialEndsAt: end,
      title: "Trial active",
      detail: `${daysRemaining} days left in your trial (ends ${end.toLocaleDateString()}).`,
      showUpgradeCta,
    };
  }

  if (daysRemaining > urgentDays) {
    return {
      severity: "reminder",
      daysRemaining,
      trialEndsAt: end,
      title: "Trial ending soon",
      detail: `${daysRemaining} days left — subscribe before ${end.toLocaleDateString()} to avoid interruption.`,
      showUpgradeCta: true,
    };
  }

  return {
    severity: "urgent",
    daysRemaining,
    trialEndsAt: end,
    title: daysRemaining <= 1 ? "Trial ends soon" : "Last days of trial",
    detail:
      daysRemaining <= 1
        ? `Your trial ends ${end.toLocaleDateString()}. Subscribe now.`
        : `${daysRemaining} days left in your trial. Subscribe to continue.`,
    showUpgradeCta: true,
  };
}
