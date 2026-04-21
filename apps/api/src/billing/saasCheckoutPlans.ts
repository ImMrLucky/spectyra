/**
 * Self-serve SaaS checkout: Developer Pro vs Team Pro.
 *
 * Stripe model: create one **Product** (optional) per tier and one **recurring Price** per tier.
 * Put each Price id in env — the Checkout Session uses a single line item at that price.
 *
 * Legacy: `STRIPE_PRICE_ID` alone maps to Developer Pro if `STRIPE_PRICE_DEVELOPER_PRO` is unset.
 */

import type Stripe from "stripe";

export const SAAS_PLAN_DEVELOPER_PRO = "developer_pro";
export const SAAS_PLAN_TEAM_PRO = "team_pro";

export type SaasCheckoutPlanSlug =
  | typeof SAAS_PLAN_DEVELOPER_PRO
  | typeof SAAS_PLAN_TEAM_PRO;

export function selfServePlanSlugsFromEnv(): SaasCheckoutPlanSlug[] {
  const out: SaasCheckoutPlanSlug[] = [];
  const dev =
    process.env.STRIPE_PRICE_DEVELOPER_PRO?.trim() || process.env.STRIPE_PRICE_ID?.trim();
  if (dev) out.push(SAAS_PLAN_DEVELOPER_PRO);
  const team = process.env.STRIPE_PRICE_TEAM_PRO?.trim();
  if (team) out.push(SAAS_PLAN_TEAM_PRO);
  return out;
}

export function resolveStripePriceIdForSaasPlan(
  slug: string | undefined,
):
  | { ok: true; priceId: string; saasPlan: SaasCheckoutPlanSlug }
  | { ok: false; error: string } {
  const raw = (slug ?? SAAS_PLAN_DEVELOPER_PRO).toLowerCase().trim();
  if (raw !== SAAS_PLAN_DEVELOPER_PRO && raw !== SAAS_PLAN_TEAM_PRO) {
    return {
      ok: false,
      error: "saas_plan must be developer_pro or team_pro",
    };
  }
  const devPrice =
    process.env.STRIPE_PRICE_DEVELOPER_PRO?.trim() || process.env.STRIPE_PRICE_ID?.trim();
  const teamPrice = process.env.STRIPE_PRICE_TEAM_PRO?.trim();

  if (raw === SAAS_PLAN_TEAM_PRO) {
    if (!teamPrice) {
      return {
        ok: false,
        error:
          "Team Pro checkout is not configured. Create a recurring monthly Price in Stripe and set STRIPE_PRICE_TEAM_PRO.",
      };
    }
    return { ok: true, priceId: teamPrice, saasPlan: SAAS_PLAN_TEAM_PRO };
  }

  if (!devPrice) {
    return {
      ok: false,
      error:
        "Developer Pro checkout is not configured. Set STRIPE_PRICE_DEVELOPER_PRO or legacy STRIPE_PRICE_ID.",
    };
  }
  return { ok: true, priceId: devPrice, saasPlan: SAAS_PLAN_DEVELOPER_PRO };
}

function firstSubscriptionItemPriceId(sub: Stripe.Subscription): string | null {
  const item0 = sub.items?.data?.[0];
  const p = item0?.price;
  if (typeof p === "string") return p;
  if (
    p &&
    typeof p === "object" &&
    "id" in p &&
    typeof (p as { id: unknown }).id === "string"
  ) {
    return (p as { id: string }).id;
  }
  return null;
}

/**
 * Map Stripe subscription → `orgs.plan` (starter = Developer Pro, pro = Team Pro).
 */
export function inferOrgPlanFromStripeSubscription(
  subscription: Stripe.Subscription,
): "starter" | "pro" | null {
  const meta = subscription.metadata?.spectyra_saas_plan?.trim().toLowerCase();
  if (meta === SAAS_PLAN_TEAM_PRO) return "pro";
  if (meta === SAAS_PLAN_DEVELOPER_PRO) return "starter";

  const priceId = firstSubscriptionItemPriceId(subscription);
  const team = process.env.STRIPE_PRICE_TEAM_PRO?.trim();
  const dev =
    process.env.STRIPE_PRICE_DEVELOPER_PRO?.trim() || process.env.STRIPE_PRICE_ID?.trim();
  if (priceId && team && priceId === team) return "pro";
  if (priceId && dev && priceId === dev) return "starter";
  return null;
}
