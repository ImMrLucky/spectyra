/**
 * Idempotent DDL for platform_roles + orgs.platform_exempt (see migrations/010_platform_roles.sql).
 * Applied at API startup so clients (desktop/web) do not 500 when production DB was never migrated manually.
 */

import { query } from "./db.js";
import { safeLog } from "../../utils/redaction.js";

export async function ensurePlatformRolesSchema(): Promise<void> {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS platform_roles (
        email TEXT PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('superuser', 'admin', 'exempt')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by_email TEXT
      )
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_platform_roles_role ON platform_roles(role)
    `);
    await query(`
      INSERT INTO platform_roles (email, role, created_by_email)
      VALUES ('gkh1974@gmail.com', 'superuser', 'migration_bootstrap')
      ON CONFLICT (email) DO NOTHING
    `);
    await query(`
      ALTER TABLE orgs ADD COLUMN IF NOT EXISTS platform_exempt BOOLEAN NOT NULL DEFAULT false
    `);
    console.log("✅ Platform roles schema ensured (010)");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "ensurePlatformRolesSchema failed", { error: msg });
    throw e;
  }
}
