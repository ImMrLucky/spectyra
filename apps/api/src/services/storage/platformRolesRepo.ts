/**
 * Platform-level roles (superuser, admin, exempt) — Postgres.
 */

import { query, queryOne } from "./db.js";

export type PlatformRoleName = "superuser" | "admin" | "exempt";

export type PlatformRoleRow = {
  email: string;
  role: PlatformRoleName;
  created_at: string;
  updated_at: string;
  created_by_email: string | null;
};

const cache = new Map<string, { role: PlatformRoleName | null; expires: number }>();
const TTL_MS = 60_000;

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

export async function getPlatformRoleByEmail(email: string | null | undefined): Promise<PlatformRoleName | null> {
  if (!email?.trim()) return null;
  const key = normEmail(email);
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) {
    return hit.role;
  }

  const row = await queryOne<{ role: PlatformRoleName }>(
    `SELECT role FROM platform_roles WHERE lower(email) = lower($1) LIMIT 1`,
    [key],
  );
  const role = row?.role ?? null;
  cache.set(key, { role, expires: now + TTL_MS });
  return role;
}

export function invalidatePlatformRoleCache(email?: string): void {
  if (email) cache.delete(normEmail(email));
  else cache.clear();
}

export async function listPlatformRoles(): Promise<PlatformRoleRow[]> {
  const result = await query<PlatformRoleRow>(
    `SELECT email, role, created_at, updated_at, created_by_email
     FROM platform_roles ORDER BY role, email`,
  );
  return result.rows;
}

export async function upsertPlatformRole(
  email: string,
  role: PlatformRoleName,
  createdByEmail: string,
): Promise<PlatformRoleRow> {
  const e = normEmail(email);
  const result = await query<PlatformRoleRow>(
    `INSERT INTO platform_roles (email, role, created_by_email, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (email) DO UPDATE SET
       role = EXCLUDED.role,
       created_by_email = EXCLUDED.created_by_email,
       updated_at = now()
     RETURNING email, role, created_at, updated_at, created_by_email`,
    [e, role, createdByEmail],
  );
  invalidatePlatformRoleCache(e);
  return result.rows[0];
}

export async function deletePlatformRole(email: string): Promise<boolean> {
  const e = normEmail(email);
  const result = await query(`DELETE FROM platform_roles WHERE lower(email) = lower($1)`, [e]);
  invalidatePlatformRoleCache(e);
  return (result.rowCount ?? 0) > 0;
}

export async function countSuperusers(): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT count(*)::text AS n FROM platform_roles WHERE role = 'superuser'`,
  );
  return parseInt(row?.n ?? "0", 10);
}
