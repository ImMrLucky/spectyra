/**
 * After a new org is created, sync BILLING_EXEMPT_EMAILS → org.platform_exempt when we can resolve the user email.
 */
import { setOrgPlatformExempt } from "../services/storage/orgsRepo.js";
import { isBillingExemptEmail } from "./billingExempt.js";
import type { SupabaseAdminUser } from "../types/supabase.js";

export async function applyPlatformExemptIfBillingListed(
  userId: string,
  orgId: string,
): Promise<void> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return;
  try {
    const response = await fetch(`${base}/auth/v1/admin/users/${userId}`, {
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
    });
    if (!response.ok) return;
    const user = (await response.json()) as SupabaseAdminUser;
    const email = user.email || user.user_metadata?.email;
    if (email && isBillingExemptEmail(email)) {
      await setOrgPlatformExempt(orgId, true);
    }
  } catch {
    /* fail open */
  }
}
