/**
 * User account flags (pause / observe-only) and admin user deletion helpers.
 */

import { query, queryOne } from "./db.js";
import { deleteOrg } from "./orgsRepo.js";
import { invalidatePlatformRoleCache } from "./platformRolesRepo.js";
import { safeLog } from "../../utils/redaction.js";

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
}

export type AccountAccessState = "active" | "paused";

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
): Promise<void> {
  const pausedAt = state === "paused" ? new Date().toISOString() : null;
  await query(
    `
    INSERT INTO user_account_flags (user_id, access_state, paused_at, updated_at)
    VALUES ($1, $2, $3, now())
    ON CONFLICT (user_id) DO UPDATE SET
      access_state = EXCLUDED.access_state,
      paused_at = EXCLUDED.paused_at,
      updated_at = now()
    `,
    [userId, state, pausedAt],
  );
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
