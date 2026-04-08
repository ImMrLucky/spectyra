/**
 * User account flags (pause / observe-only) and admin user deletion helpers.
 */

import { query, queryOne } from "./db.js";
import {
  applyInactiveBillingLockForOwnerOrgs,
  clearInactiveBillingLockForUser,
  deleteOrg,
} from "./orgsRepo.js";
import { invalidatePlatformRoleCache } from "./platformRolesRepo.js";
import { safeLog } from "../../utils/redaction.js";
import {
  pauseStripeSubscriptionsForOwnerOrgs,
  resumeStripeSubscriptionsForOwnerOrgs,
  type StripePauseResult,
} from "../../billing/stripeSubscriptionPause.js";

/** Full app + savings access after admin pause until this instant; then read-only Observe until reactivated. */
export const PAUSE_SAVINGS_GRACE_DAYS = 30;

function addUtcDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Idempotent DDL (no FK to auth.users — works on any Postgres; migrations add FK on Supabase).
 */
export async function ensureUserAccountFlagsSchema(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS user_account_flags (
      user_id UUID PRIMARY KEY,
      access_state TEXT NOT NULL DEFAULT 'active' CHECK (access_state IN ('active', 'paused')),
      paused_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await query(`
    CREATE INDEX IF NOT EXISTS idx_user_account_flags_state ON user_account_flags (access_state)
  `);
  await query(`
    ALTER TABLE user_account_flags
    ADD COLUMN IF NOT EXISTS pause_savings_until TIMESTAMPTZ
  `);
}

export type AccountAccessState = "active" | "paused" | "inactive";

function emptyStripeResult(): StripePauseResult {
  return { subscriptionIdsPaused: [], subscriptionIdsResumed: [], orgIds: [], warnings: [] };
}

export async function getAccountAccessState(userId: string): Promise<AccountAccessState> {
  const row = await queryOne<{ access_state: AccountAccessState }>(
    `SELECT access_state FROM user_account_flags WHERE user_id = $1`,
    [userId],
  );
  return row?.access_state ?? "active";
}

export async function setAccountAccessState(
  userId: string,
  state: AccountAccessState,
): Promise<{ stripe: StripePauseResult }> {
  const prev = await getAccountAccessState(userId);
  const now = new Date();
  const pausedAt = state === "paused" ? now.toISOString() : null;
  const pauseSavingsUntil =
    state === "paused" ? addUtcDays(now, PAUSE_SAVINGS_GRACE_DAYS).toISOString() : null;

  await query(
    `
    INSERT INTO user_account_flags (user_id, access_state, paused_at, pause_savings_until, updated_at)
    VALUES ($1, $2, $3, $4, now())
    ON CONFLICT (user_id) DO UPDATE SET
      access_state = EXCLUDED.access_state,
      paused_at = EXCLUDED.paused_at,
      pause_savings_until = EXCLUDED.pause_savings_until,
      updated_at = now()
    `,
    [userId, state, pausedAt, pauseSavingsUntil],
  );

  // Observe-only lock on owned orgs (skips platform_exempt). Not the same as JWT "paused" read-only.
  if (prev !== "inactive" && state === "inactive") {
    await applyInactiveBillingLockForOwnerOrgs(userId);
  } else if (prev === "inactive" && state !== "inactive") {
    await clearInactiveBillingLockForUser(userId);
  }

  let stripe: StripePauseResult;
  if (state === "paused") {
    stripe = await pauseStripeSubscriptionsForOwnerOrgs(userId);
    if (stripe.warnings.length) {
      safeLog("warn", "setAccountAccessState: Stripe pause warnings", { userId, warnings: stripe.warnings });
    }
  } else if (state === "inactive") {
    // Do not auto-resume Stripe here (e.g. paused → inactive should keep pause_collection).
    // Entering inactive from active does not pause Stripe — real savings are gated by observe lock only.
    stripe = emptyStripeResult();
  } else {
    // state === "active"
    if (prev === "paused" || prev === "inactive") {
      stripe = await resumeStripeSubscriptionsForOwnerOrgs(userId);
      if (stripe.warnings.length) {
        safeLog("warn", "setAccountAccessState: Stripe resume warnings", { userId, warnings: stripe.warnings });
      }
    } else {
      stripe = emptyStripeResult();
    }
  }

  return { stripe };
}

/**
 * Remove app data for a user, then caller deletes Supabase auth user.
 * - Sole member of an org (any role): deletes entire org (same as org delete).
 * - Multi-member org: removes only this user's membership row.
 * - Removes platform_roles row for this email if present.
 */
export async function deleteUserDataAndMemberships(options: {
  userId: string;
  email: string | null;
}): Promise<{ orgsDeleted: string[]; membershipsRemoved: number }> {
  const { userId, email } = options;
  const orgsDeleted: string[] = [];
  let membershipsRemoved = 0;

  const memberships = await query<{ org_id: string; role: string }>(
    `SELECT org_id, role FROM org_memberships WHERE user_id = $1`,
    [userId],
  );

  const seenOrg = new Set<string>();
  for (const m of memberships.rows) {
    if (seenOrg.has(m.org_id)) continue;
    seenOrg.add(m.org_id);

    const countRow = await queryOne<{ n: string }>(
      `SELECT count(*)::text AS n FROM org_memberships WHERE org_id = $1`,
      [m.org_id],
    );
    const n = parseInt(countRow?.n ?? "0", 10);

    if (n <= 1) {
      await deleteOrg(m.org_id);
      orgsDeleted.push(m.org_id);
      safeLog("info", "deleteUser: removed sole-member org", { orgId: m.org_id, userId });
    } else {
      await query(`DELETE FROM org_memberships WHERE org_id = $1 AND user_id = $2`, [
        m.org_id,
        userId,
      ]);
      membershipsRemoved += 1;
      safeLog("info", "deleteUser: removed org membership", { orgId: m.org_id, userId });
    }
  }

  if (email?.trim()) {
    await query(`DELETE FROM platform_roles WHERE lower(email) = lower($1)`, [email.trim()]);
    invalidatePlatformRoleCache(email.trim());
  }

  await query(`DELETE FROM user_account_flags WHERE user_id = $1`, [userId]);

  return { orgsDeleted, membershipsRemoved };
}
