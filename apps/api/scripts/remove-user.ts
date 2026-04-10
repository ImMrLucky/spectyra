/**
 * One-off: remove a user like DELETE /v1/admin/users/:userId
 * (Stripe cancel + DB cleanup + Supabase Auth delete).
 *
 * Usage (from apps/api, with .env loaded):
 *   pnpm exec tsx scripts/remove-user.ts <user-uuid> [--inspect] [--org <name>] [--skip-auth]
 *
 * --inspect  Print email, org memberships, flags, then exit (no deletion).
 * --org      Abort unless the user is a member of an org with this name (case-insensitive).
 *            Does not limit deletion to that org — full user removal, same as admin API.
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDb, query, queryOne } from "../src/services/storage/db.js";
import { deleteUserDataAndMemberships } from "../src/services/storage/userAccountRepo.js";
import { cancelStripeSubscriptionsForOwnerOrgsOnAccountClosure } from "../src/billing/stripeSubscriptionCancelOnAccountDelete.js";
import type { SupabaseAdminUser } from "../src/types/supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
initDb();

function supabaseAdminHeaders(): { base: string; headers: Record<string, string> } | null {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return null;
  return {
    base,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  };
}

function parseCli(argv: string[]) {
  let inspect = false;
  let skipAuth = false;
  let expectOrg: string | null = null;
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--inspect") inspect = true;
    else if (a === "--skip-auth") skipAuth = true;
    else if (a === "--org" && argv[i + 1]) {
      expectOrg = argv[++i].trim();
    } else if (a.startsWith("-")) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    } else {
      positionals.push(a);
    }
  }
  const userId = positionals.find((p) => /^[0-9a-f-]{36}$/i.test(p)) ?? null;
  return { inspect, skipAuth, expectOrg, userId };
}

async function inspectUser(userId: string) {
  const cfg = supabaseAdminHeaders();

  const memberships = await query<{
    org_id: string;
    org_name: string;
    role: string;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    subscription_status: string | null;
  }>(
    `
    SELECT
      o.id AS org_id,
      o.name AS org_name,
      om.role::text AS role,
      o.stripe_customer_id,
      o.stripe_subscription_id,
      o.subscription_status::text AS subscription_status
    FROM org_memberships om
    JOIN orgs o ON o.id = om.org_id
    WHERE om.user_id = $1
    ORDER BY o.name
    `,
    [userId],
  );

  let auth: Record<string, unknown> | null = null;
  let email: string | null = null;
  if (cfg) {
    const uRes = await fetch(`${cfg.base}/auth/v1/admin/users/${userId}`, { headers: cfg.headers });
    if (uRes.ok) {
      const target = (await uRes.json()) as SupabaseAdminUser;
      email = target.email || target.user_metadata?.email || null;
      auth = {
        id: target.id,
        email: target.email ?? null,
        created_at: target.created_at ?? null,
        last_sign_in_at: target.last_sign_in_at ?? null,
        email_confirmed_at: target.email_confirmed_at ?? null,
      };
    } else {
      auth = { error: `HTTP ${uRes.status}` };
    }
  } else {
    auth = { error: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set" };
  }

  let platformRole: string | null = null;
  if (email?.trim()) {
    const pr = await queryOne<{ role: string }>(
      `SELECT role::text AS role FROM platform_roles WHERE lower(email) = lower($1)`,
      [email.trim()],
    );
    platformRole = pr?.role ?? null;
  }

  const flags = await queryOne<{
    access_state: string;
    paused_at: string | null;
    pause_savings_until: string | null;
  }>(`SELECT access_state, paused_at, pause_savings_until FROM user_account_flags WHERE user_id = $1`, [
    userId,
  ]);

  const report = {
    user_id: userId,
    supabase_auth: auth,
    email_for_platform_roles: email,
    platform_role: platformRole,
    user_account_flags: flags,
    org_memberships: memberships.rows,
    what_full_delete_does: [
      "Stripe: cancel subscriptions for orgs where this user is OWNER (immediate); delete Stripe customers when safe.",
      "Postgres: remove memberships; delete entire org if this user was the only member; delete platform_roles row for email; delete user_account_flags.",
      "Supabase Auth: delete the auth user (unless --skip-auth).",
    ],
  };

  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  const { inspect, skipAuth, expectOrg, userId } = parseCli(process.argv.slice(2));

  if (!userId) {
    console.error(
      "Usage: pnpm exec tsx scripts/remove-user.ts <user-uuid> [--inspect] [--org <org-name>] [--skip-auth]",
    );
    process.exit(1);
  }

  if (inspect) {
    await inspectUser(userId);
    return;
  }

  const r = await query<{ name: string }>(
    `
    SELECT o.name
    FROM org_memberships om
    JOIN orgs o ON o.id = om.org_id
    WHERE om.user_id = $1
    `,
    [userId],
  );
  const orgNames = r.rows.map((row) => row.name);
  if (expectOrg) {
    const ok = orgNames.some((n) => n.trim().toLowerCase() === expectOrg.toLowerCase());
    if (!ok) {
      console.error(
        `Refusing: user is not a member of org "${expectOrg}". Member of: ${JSON.stringify(orgNames)}`,
      );
      process.exit(1);
    }
  }

  const cfg = supabaseAdminHeaders();
  let email: string | null = null;
  if (cfg) {
    const uRes = await fetch(`${cfg.base}/auth/v1/admin/users/${userId}`, { headers: cfg.headers });
    if (uRes.ok) {
      const target = (await uRes.json()) as SupabaseAdminUser;
      email = target.email || target.user_metadata?.email || null;
    } else {
      console.warn(`Supabase GET user: HTTP ${uRes.status} (continuing; platform_roles may need manual cleanup)`);
    }
  } else {
    console.warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — skipping auth lookup and auth delete.");
  }

  console.log("Canceling Stripe subscriptions (immediate) for owner orgs…");
  const stripe = await cancelStripeSubscriptionsForOwnerOrgsOnAccountClosure(userId, "immediately");
  if (stripe.warnings.length) {
    console.warn("Stripe warnings:", stripe.warnings);
  }
  console.log("Canceled subs:", stripe.canceledImmediately, "Customers deleted:", stripe.customersDeleted);

  console.log("Deleting app data and memberships…");
  const summary = await deleteUserDataAndMemberships({ userId, email });
  console.log("Summary:", summary);

  if (skipAuth) {
    console.log("Done (--skip-auth: Supabase Auth user not deleted).");
    return;
  }

  if (!cfg) {
    console.warn("Done (DB). Configure Supabase admin env to delete auth user.");
    return;
  }

  const delRes = await fetch(`${cfg.base}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: cfg.headers,
  });
  if (!delRes.ok) {
    const errText = await delRes.text().catch(() => "");
    console.error(`Supabase DELETE user failed: HTTP ${delRes.status}`, errText.slice(0, 300));
    process.exit(1);
  }
  console.log("Supabase Auth user deleted.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
