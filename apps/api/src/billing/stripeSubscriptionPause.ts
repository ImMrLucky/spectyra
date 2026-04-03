/**
 * Pause / resume Stripe subscription collection when a user account is paused/reactivated.
 * Targets orgs where the user is OWNER and the org has a Stripe subscription id.
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

export type StripePauseResult = {
  subscriptionIdsPaused: string[];
  subscriptionIdsResumed: string[];
  orgIds: string[];
  warnings: string[];
};

/**
 * Stop charging: invoices are not attempted while pause_collection is set.
 * Subscription stays in a state Stripe can resume from.
 */
export async function pauseStripeSubscriptionsForOwnerOrgs(userId: string): Promise<StripePauseResult> {
  const stripe = getStripe();
  const subscriptionIdsPaused: string[] = [];
  const orgIds: string[] = [];
  const warnings: string[] = [];

  if (!stripe) {
    warnings.push("STRIPE_SECRET_KEY not set; skipped Stripe pause_collection.");
    return { subscriptionIdsPaused, subscriptionIdsResumed: [], orgIds, warnings };
  }

  const r = await query<{ org_id: string; stripe_subscription_id: string | null }>(
    `
    SELECT o.id AS org_id, o.stripe_subscription_id
    FROM org_memberships om
    JOIN orgs o ON o.id = om.org_id
    WHERE om.user_id = $1
      AND om.role = 'OWNER'
      AND o.stripe_subscription_id IS NOT NULL
      AND trim(o.stripe_subscription_id) <> ''
    `,
    [userId],
  );

  for (const row of r.rows) {
    const subId = row.stripe_subscription_id!;
    try {
      await stripe.subscriptions.update(subId, {
        pause_collection: { behavior: "void" },
      });
      subscriptionIdsPaused.push(subId);
      orgIds.push(row.org_id);
      safeLog("info", "Stripe pause_collection applied", { orgId: row.org_id, subscriptionId: subId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`org ${row.org_id} (${subId}): ${msg}`);
      safeLog("warn", "Stripe pause_collection failed", { orgId: row.org_id, subscriptionId: subId, error: msg });
    }
  }

  return { subscriptionIdsPaused, subscriptionIdsResumed: [], orgIds, warnings };
}

/** Resume charging for the same OWNER org subscriptions. */
export async function resumeStripeSubscriptionsForOwnerOrgs(userId: string): Promise<StripePauseResult> {
  const stripe = getStripe();
  const subscriptionIdsResumed: string[] = [];
  const orgIds: string[] = [];
  const warnings: string[] = [];

  if (!stripe) {
    warnings.push("STRIPE_SECRET_KEY not set; skipped Stripe resume.");
    return { subscriptionIdsPaused: [], subscriptionIdsResumed, orgIds, warnings };
  }

  const r = await query<{ org_id: string; stripe_subscription_id: string | null }>(
    `
    SELECT o.id AS org_id, o.stripe_subscription_id
    FROM org_memberships om
    JOIN orgs o ON o.id = om.org_id
    WHERE om.user_id = $1
      AND om.role = 'OWNER'
      AND o.stripe_subscription_id IS NOT NULL
      AND trim(o.stripe_subscription_id) <> ''
    `,
    [userId],
  );

  for (const row of r.rows) {
    const subId = row.stripe_subscription_id!;
    try {
      // Clear pause_collection (resume invoicing). Cast: Stripe types allow null at runtime.
      await stripe.subscriptions.update(subId, {
        pause_collection: null,
      } as Stripe.SubscriptionUpdateParams);
      subscriptionIdsResumed.push(subId);
      orgIds.push(row.org_id);
      safeLog("info", "Stripe pause_collection cleared (resume)", { orgId: row.org_id, subscriptionId: subId });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`org ${row.org_id} (${subId}): ${msg}`);
      safeLog("warn", "Stripe resume failed", { orgId: row.org_id, subscriptionId: subId, error: msg });
    }
  }

  return { subscriptionIdsPaused: [], subscriptionIdsResumed, orgIds, warnings };
}
