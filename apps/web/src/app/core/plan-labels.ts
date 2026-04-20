/**
 * Maps internal {@link PlanType} values to product marketing names.
 * API / DB: free | starter | pro | enterprise
 */

const PLAN_MARKETING: Record<string, string> = {
  free: 'Free Tier',
  starter: 'Developer Pro',
  pro: 'Team Pro',
  enterprise: 'Enterprise',
};

export function planMarketingName(plan: string | null | undefined): string {
  if (plan == null || plan === '') return PLAN_MARKETING['free']!;
  return PLAN_MARKETING[plan] ?? plan;
}

export function workspaceHeaderPlanLabel(args: {
  plan: string | null | undefined;
  paidSubscriptionActive: boolean;
  billingExemptWorkspace: boolean;
}): string {
  if (args.billingExemptWorkspace) return 'Full platform';
  const base = planMarketingName(args.plan);
  if (args.paidSubscriptionActive) return base;
  if (args.plan === 'enterprise') return `${base} (contract)`;
  return base;
}

export function workspacePlanCardHeadline(args: {
  plan: string | null | undefined;
  paidSubscriptionActive: boolean;
  billingExemptWorkspace: boolean;
}): string {
  if (args.billingExemptWorkspace) return 'Full platform access';
  if (args.paidSubscriptionActive) {
    return `${planMarketingName(args.plan)} — active subscription`;
  }
  if (args.plan === 'enterprise') return 'Enterprise (contract)';
  return `${planMarketingName(args.plan)} workspace`;
}
