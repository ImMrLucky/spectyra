/**
 * Idempotent DDL applied at API startup so production/staging DBs that
 * were never migrated manually do not 500.
 *
 * Covers: platform_roles, orgs billing columns, analytics_sessions_sync.
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
    await query(`
      ALTER TABLE orgs ADD COLUMN IF NOT EXISTS sdk_access_enabled BOOLEAN NOT NULL DEFAULT true
    `);
    await query(`
      ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT
    `);
    await query(`
      ALTER TABLE orgs ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ
    `);
    await query(`
      ALTER TABLE orgs ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false
    `);
    // analytics_sessions_sync — TEXT org_id (no FK) so startup works regardless of orgs.id type
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS analytics_sessions_sync (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          org_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          run_id TEXT NOT NULL,
          payload JSONB NOT NULL,
          sync_state TEXT NOT NULL DEFAULT 'synced',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          UNIQUE(org_id, session_id)
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_analytics_sessions_org_id ON analytics_sessions_sync(org_id)
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_analytics_sessions_created ON analytics_sessions_sync(org_id, created_at DESC)
      `);
    } catch (ae: unknown) {
      const m = ae instanceof Error ? ae.message : String(ae);
      safeLog("warn", "analytics_sessions_sync DDL skipped or partial", { error: m });
    }

    console.log("✅ Startup schema ensured");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    safeLog("error", "ensureStartupSchema failed", { error: msg });
    throw e;
  }
}
