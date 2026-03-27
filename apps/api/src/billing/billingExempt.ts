/**
 * Founder / comp access without Stripe — configure via env (comma-separated).
 * BILLING_EXEMPT_EMAILS: user emails (case-insensitive), e.g. founder@company.com
 * BILLING_EXEMPT_ORG_IDS: org UUIDs for API-key-only flows where email is unavailable
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
