/**
 * Product copy and defaults. Billing amount is enforced by Stripe (STRIPE_PRICE_ID on API); keep labels in sync.
 */
export const SPECTYRA_TRIAL_DAYS = 14;
/** Shown in billing, register, and marketing copy — Stripe price id must match your dashboard. */
export const SPECTYRA_MONTHLY_PRICE_LABEL = "$4.99/month (early adopters)";

/** SaaS SDK + telemetry tiers (marketing copy; enforce limits in API / Stripe). */
export const SAAS_PLAN_CARDS: Array<{
  id: string;
  name: string;
  price: string;
  bullets: string[];
}> = [
  {
    id: "developer_pro",
    name: "Developer Pro",
    price: "$29/month",
    bullets: ["50k optimized tokens free to start", "+ 50k / month included", "SDK + project / env dashboards", "POST /v1/telemetry/run"],
  },
  {
    id: "team_pro",
    name: "Team Pro",
    price: "$99/month",
    bullets: ["150k optimized tokens free to start", "+ 150k / month included", "Shared org analytics", "Priority support"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Contract",
    bullets: ["Custom limits & SLAs", "VPC / security review", "Dedicated support", "Invoicing"],
  },
];
