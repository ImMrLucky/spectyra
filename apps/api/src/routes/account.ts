/**
 * Self-service account: cancel subscription, pause service, delete account (JWT only).
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import Stripe from "stripe";
import {
  requireUserSession,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { query, queryOne } from "../services/storage/db.js";
import {
  deleteUserDataAndMemberships,
  getAccountAccessState,
  setAccountAccessState,
  type AccountAccessState,
} from "../services/storage/userAccountRepo.js";
import { countSuperusers, getPlatformRoleByEmail } from "../services/storage/platformRolesRepo.js";
import { safeLog } from "../utils/redaction.js";
import type { SupabaseAdminUser } from "../types/supabase.js";
import { applySubscriptionPayloadToKnownOrg } from "./billing.js";
import { cancelStripeSubscriptionsForOwnerOrgsOnAccountClosure } from "../billing/stripeSubscriptionCancelOnAccountDelete.js";

export const accountRouter = Router();

accountRouter.use(
  rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many account requests; try again shortly." },
  }),
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
});

function supabaseAdminHeaders(): { base: string; headers: Record<string, string> } | null {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  return {
    base,
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
    },
  };
}

type OwnedSubRow = {
  org_id: string;
  org_name: string;
  stripe_subscription_id: string;
  subscription_status: string;
  cancel_at_period_end: boolean | null;
  subscription_current_period_end: string | null;
};

async function listOwnedStripeSubscriptions(userId: string): Promise<OwnedSubRow[]> {
  const r = await query<OwnedSubRow>(
    `
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      o.stripe_subscription_id,
      o.subscription_status::text AS subscription_status,
      o.cancel_at_period_end,
      o.subscription_current_period_end
    FROM org_memberships om
    JOIN orgs o ON o.id = om.org_id
    WHERE om.user_id = $1
      AND lower(om.role::text) = 'owner'
      AND o.stripe_subscription_id IS NOT NULL
      AND trim(o.stripe_subscription_id) <> ''
    ORDER BY o.created_at ASC
    `,
    [userId],
  );
  return r.rows;
}

accountRouter.get("/summary", requireUserSession, async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    let access_state: AccountAccessState = "active";
    let pause_savings_until: string | null = null;
    try {
      access_state = await getAccountAccessState(userId);
      const row = await queryOne<{ pause_savings_until: string | null }>(
        `SELECT pause_savings_until FROM user_account_flags WHERE user_id = $1`,
        [userId],
      );
      pause_savings_until = row?.pause_savings_until ?? null;
    } catch {
      /* flags table optional */
    }

    const owned_subscriptions = await listOwnedStripeSubscriptions(userId);
    const has_cancellable_paid = owned_subscriptions.some((s) =>
      ["active", "trialing", "past_due"].includes(s.subscription_status),
    );

    return res.json({
      user_id: userId,
      access_state,
      pause_savings_until,
      owned_subscriptions,
      has_cancellable_subscription: has_cancellable_paid,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    safeLog("error", "account summary", { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * Stop renewal at end of current period (Stripe). Owner-only orgs with a subscription.
 */
accountRouter.post(
  "/subscription/cancel-at-period-end",
  requireUserSession,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!process.env.STRIPE_SECRET_KEY?.trim()) {
        return res.status(503).json({ error: "Billing is not configured" });
      }
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const owned = await listOwnedStripeSubscriptions(userId);
      const actionable = owned.filter((o) =>
        ["active", "trialing", "past_due"].includes(o.subscription_status),
      );
      if (actionable.length === 0) {
        return res.status(400).json({ error: "No active subscription to cancel" });
      }

      const updated: string[] = [];
      const warnings: string[] = [];
      for (const o of actionable) {
        try {
          await stripe.subscriptions.update(o.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
          updated.push(o.org_id);
          try {
            const sub = await stripe.subscriptions.retrieve(o.stripe_subscription_id);
            await applySubscriptionPayloadToKnownOrg(o.org_id, sub);
          } catch (syncErr: unknown) {
            const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
            safeLog("warn", "cancel-at-period-end: DB sync after Stripe update failed", {
              org_id: o.org_id,
              error: msg,
            });
            warnings.push(`org ${o.org_id}: local sync failed (${msg})`);
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(`org ${o.org_id}: ${msg}`);
        }
      }

      safeLog("info", "self-service cancel at period end", { userId, orgs: updated });
      return res.json({
        ok: true,
        cancel_at_period_end: true,
        org_ids_updated: updated,
        warnings,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Internal server error";
      safeLog("error", "account cancel subscription", { error: message });
      return res.status(500).json({ error: message });
    }
  },
);

/** Undo scheduled cancellation (if still before period end). */
accountRouter.post(
  "/subscription/keep",
  requireUserSession,
  async (req: AuthenticatedRequest, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      return res.status(503).json({ error: "Billing is not configured" });
    }
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const owned = await listOwnedStripeSubscriptions(userId);
    const updated: string[] = [];
    const warnings: string[] = [];
    for (const o of owned) {
      if (!o.cancel_at_period_end) continue;
      try {
        await stripe.subscriptions.update(o.stripe_subscription_id, {
          cancel_at_period_end: false,
        });
        updated.push(o.org_id);
        try {
          const sub = await stripe.subscriptions.retrieve(o.stripe_subscription_id);
          await applySubscriptionPayloadToKnownOrg(o.org_id, sub);
        } catch (syncErr: unknown) {
          const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
          safeLog("warn", "keep subscription: DB sync after Stripe update failed", {
            org_id: o.org_id,
            error: msg,
          });
          warnings.push(`org ${o.org_id}: local sync failed (${msg})`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`org ${o.org_id}: ${msg}`);
      }
    }

    if (updated.length === 0) {
      return res.status(400).json({ error: "No subscription was scheduled for cancellation" });
    }

    safeLog("info", "self-service keep subscription", { userId, orgs: updated });
    return res.json({ ok: true, cancel_at_period_end: false, org_ids_updated: updated, warnings });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    safeLog("error", "account keep subscription", { error: message });
    return res.status(500).json({ error: message });
  }
});

/** Pause cloud account (Stripe pause_collection + grace — same as admin Pause). */
accountRouter.post(
  "/pause-service",
  requireUserSession,
  async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { stripe: stripeResult } = await setAccountAccessState(userId, "paused");
    const until = await queryOne<{ pause_savings_until: string | null }>(
      `SELECT pause_savings_until FROM user_account_flags WHERE user_id = $1`,
      [userId],
    );
    safeLog("info", "self-service pause service", { userId });
    return res.json({
      access_state: "paused" as const,
      pause_savings_until: until?.pause_savings_until ?? null,
      stripe: stripeResult,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    safeLog("error", "account pause service", { error: message });
    return res.status(500).json({ error: message });
  }
});

/** Resume from admin/self pause (active). */
accountRouter.post(
  "/resume-service",
  requireUserSession,
  async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const prev = await getAccountAccessState(userId);
    if (prev === "inactive") {
      return res.status(400).json({
        error:
          "Account is set to Inactive by an administrator. Contact support or use billing settings after they restore access.",
      });
    }

    const { stripe: stripeResult } = await setAccountAccessState(userId, "active");
    const until = await queryOne<{ pause_savings_until: string | null }>(
      `SELECT pause_savings_until FROM user_account_flags WHERE user_id = $1`,
      [userId],
    );
    safeLog("info", "self-service resume service", { userId });
    return res.json({
      access_state: "active" as const,
      pause_savings_until: until?.pause_savings_until ?? null,
      stripe: stripeResult,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    safeLog("error", "account resume service", { error: message });
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /v1/account/delete — remove app data and Supabase Auth user (irreversible).
 * Body: { "confirm": "DELETE_MY_ACCOUNT" }
 */
accountRouter.post(
  "/delete",
  requireUserSession,
  rateLimit({
    windowMs: 60_000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many account deletion requests; try again shortly." },
  }),
  async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.auth?.userId;
    const email = req.auth?.email?.trim() || null;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { confirm } = req.body as { confirm?: string };
    if (confirm !== "DELETE_MY_ACCOUNT") {
      return res.status(400).json({
        error: 'Confirmation required: send JSON body { "confirm": "DELETE_MY_ACCOUNT" }',
      });
    }

    const cfg = supabaseAdminHeaders();
    if (!cfg) {
      return res.status(503).json({ error: "Account deletion is not configured (Supabase admin)" });
    }

    const uRes = await fetch(`${cfg.base}/auth/v1/admin/users/${userId}`, { headers: cfg.headers });
    if (!uRes.ok) {
      return res.status(uRes.status === 404 ? 404 : 502).json({ error: "User not found in auth provider" });
    }
    const target = (await uRes.json()) as SupabaseAdminUser;
    const targetEmail = target.email || target.user_metadata?.email || email;

    const role = targetEmail ? await getPlatformRoleByEmail(targetEmail) : null;
    if (role === "superuser" && (await countSuperusers()) <= 1) {
      return res.status(400).json({ error: "Cannot delete the last platform superuser from this flow" });
    }

    const stripeClosure = await cancelStripeSubscriptionsForOwnerOrgsOnAccountClosure(userId, "at_period_end");
    const summary = await deleteUserDataAndMemberships({ userId, email: targetEmail ?? email });

    const delRes = await fetch(`${cfg.base}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: cfg.headers,
    });
    if (!delRes.ok) {
      const errText = await delRes.text().catch(() => "");
      safeLog("error", "account self-delete: Supabase DELETE failed", {
        status: delRes.status,
        errText: errText.slice(0, 200),
      });
      return res.status(502).json({
        error: "Data removed but auth user deletion failed — contact support",
        orgs_deleted: summary.orgsDeleted,
        memberships_removed: summary.membershipsRemoved,
        stripe_subscriptions_scheduled_period_end: stripeClosure.scheduledPeriodEnd,
        stripe_warnings: stripeClosure.warnings.length ? stripeClosure.warnings : undefined,
      });
    }

    safeLog("info", "self-service account deleted", { userId });
    return res.json({
      deleted: true,
      user_id: userId,
      orgs_deleted: summary.orgsDeleted,
      memberships_removed: summary.membershipsRemoved,
      stripe_subscriptions_scheduled_period_end: stripeClosure.scheduledPeriodEnd,
      stripe_warnings: stripeClosure.warnings.length ? stripeClosure.warnings : undefined,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Internal server error";
    safeLog("error", "account delete self", { error: message });
    return res.status(500).json({ error: message });
  }
});
