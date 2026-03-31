/**
 * Founder / comp access without Stripe — configure via env (comma-separated).
 *
 * - BILLING_EXEMPT_EMAILS: user emails (case-insensitive). JWT routes get unlimited
 *   optimized runs; new bootstraps get org.platform_exempt; existing users are synced
 *   when the web app loads /auth/me (POST /v1/auth/sync-billing-exempt).
 * - BILLING_EXEMPT_ORG_IDS: org UUIDs for API-key-only flows (no Supabase email on the request).
 *
 * Or use Superuser → platform_exempt on an org, or set platform_exempt in the database.
 */

function parseList(env: string | undefined): Set<string> {
  const set = new Set<string>();
  if (!env?.trim()) return set;
  for (const part of env.split(",")) {
    const s = part.trim().toLowerCase();
    if (s) set.add(s);
  }
  return set;
}

const exemptEmails = () => parseList(process.env.BILLING_EXEMPT_EMAILS);
const exemptOrgIds = () => parseList(process.env.BILLING_EXEMPT_ORG_IDS);

export function isBillingExemptEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  return exemptEmails().has(email.trim().toLowerCase());
}

export function isBillingExemptOrgId(orgId: string | null | undefined): boolean {
  if (!orgId?.trim()) return false;
  return exemptOrgIds().has(orgId.trim().toLowerCase());
}
