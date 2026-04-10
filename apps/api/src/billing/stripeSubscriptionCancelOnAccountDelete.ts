/**
 * Cancel Stripe subscriptions when an account is closed (self-delete vs admin delete).
 */

import Stripe from "stripe";
import { query } from "../services/storage/db.js";
import { safeLog } from "../utils/redaction.js";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  return new Stripe(key, {
    apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
  });
}

export type StripeCancelOnAccountDeleteResult = {
  /** Subscription ids scheduled with cancel_at_period_end */
  scheduledPeriodEnd: string[];
  /** Subscription ids canceled immediately */
  canceledImmediately: string[];
  /** Stripe customer ids we deleted (immediate mode only, after all subs canceled) */
  customersDeleted: string[];
  warnings: string[];
};

/**
 * For each org where this user is OWNER and a Stripe subscription id exists:
 * - `at_period_end`: set cancel_at_period_end (no renewal; current period remains as Stripe defines it)
 * - `immediately`: cancel subscription now, then delete Stripe customer when safe
 *
 * Idempotent: skips subs that are already canceled or incomplete_expired.
 */
export async function cancelStripeSubscriptionsForOwnerOrgsOnAccountClosure(
  userId: string,
  mode: "at_period_end" | "immediately",
): Promise<StripeCancelOnAccountDeleteResult> {
  const stripe = getStripe();
  const scheduledPeriodEnd: string[] = [];
  const canceledImmediately: string[] = [];
  const customersDeleted: string[] = [];
  const warnings: string[] = [];

  if (!stripe) {
    warnings.push("STRIPE_SECRET_KEY not set; skipped Stripe subscription cancellation.");
    return { scheduledPeriodEnd, canceledImmediately, customersDeleted, warnings };
  }

  const r = await query<{
    org_id: string;
    stripe_subscription_id: string | null;
    stripe_customer_id: string | null;
  }>(
    `
    SELECT o.id AS org_id, o.stripe_subscription_id, o.stripe_customer_id
    FROM org_memberships om
    JOIN orgs o ON o.id = om.org_id
    WHERE om.user_id = $1
      AND lower(om.role::text) = 'owner'
      AND o.stripe_subscription_id IS NOT NULL
      AND trim(o.stripe_subscription_id) <> ''
    `,
    [userId],
  );

  const customerIds = new Set<string>();

  for (const row of r.rows) {
    const subId = row.stripe_subscription_id!.trim();
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const status = sub.status;
      if (status === "canceled" || status === "incomplete_expired") {
        safeLog("info", "Stripe sub already terminal; skip", { subId, status });
        continue;
      }

      if (mode === "at_period_end") {
        if (sub.cancel_at_period_end) {
          scheduledPeriodEnd.push(subId);
        } else {
          await stripe.subscriptions.update(subId, { cancel_at_period_end: true });
          scheduledPeriodEnd.push(subId);
          safeLog("info", "Stripe cancel_at_period_end set (account closure)", { orgId: row.org_id, subId });
        }
      } else {
        await stripe.subscriptions.cancel(subId);
        canceledImmediately.push(subId);
        safeLog("info", "Stripe subscription canceled immediately (admin delete)", { orgId: row.org_id, subId });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`org ${row.org_id} (${subId}): ${msg}`);
      safeLog("warn", "Stripe cancel on account closure failed", { orgId: row.org_id, subId, error: msg });
    }

    if (row.stripe_customer_id?.trim()) {
      customerIds.add(row.stripe_customer_id.trim());
    }
  }

  if (mode === "immediately") {
    for (const cid of customerIds) {
      try {
        await stripe.customers.del(cid);
        customersDeleted.push(cid);
        safeLog("info", "Stripe customer deleted after subscription cancel", { customerId: cid });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`customer ${cid}: ${msg}`);
        safeLog("warn", "Stripe customer delete failed (non-fatal)", { customerId: cid, error: msg });
      }
    }
  }

  return { scheduledPeriodEnd, canceledImmediately, customersDeleted, warnings };
}
