/**
 * Idempotent Spectyra account provisioning: org + default project + first API key (+ license key).
 * Used by POST /auth/bootstrap, POST /auth/ensure-account, and shared logic.
 */

import crypto from "node:crypto";
import type { Org, Project } from "@spectyra/shared";
import { tx, query } from "./storage/db.js";
import { safeLog } from "../utils/redaction.js";
import {
  createApiKey,
  getDefaultOrgSeatLimit,
  getOrgById,
  getOrgProjects,
  hashApiKey,
} from "./storage/orgsRepo.js";
import { audit } from "./audit/audit.js";
import { applyPlatformExemptIfBillingListed } from "../billing/applyPlatformExemptForNewUser.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

/** Default org label when the client does not pass `org_name` (e.g. CLI ensure-account). */
export function defaultOrgNameFromEmail(email: string | null | undefined): string {
  if (!email?.includes("@")) return "My workspace";
  let local = email.split("@")[0]?.trim() || "account";
  local = local.replace(/[<>\"'&]/g, "");
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  local = local.trim() || "account";
  const titled = local.charAt(0).toUpperCase() + local.slice(1);
  return `${titled}'s workspace`;
}

export type ProvisionOutcome =
  | {
      status: "existing";
      org: Org;
      projects: Project[];
    }
  | {
      status: "created";
      org: Org;
      project: Project;
      api_key: string;
      api_key_id: string;
      license_key: string | null;
    };

type ProvisionParams = {
  userId: string;
  orgName: string;
  projectName?: string;
  auditReq?: AuthenticatedRequest;
};

/**
 * Create org + project + membership + API key (+ license) if the user has no org yet.
 * Serialized per user with pg_advisory_xact_lock to avoid duplicate orgs under concurrency.
 */
export async function provisionSpectyraAccountIfNeeded(
  params: ProvisionParams,
): Promise<ProvisionOutcome> {
  const { userId, orgName, projectName = "Default Project", auditReq } = params;
  const trimmedOrg = orgName.trim();
  if (!trimmedOrg) {
    throw new Error("Organization name is required");
  }

  const created = await tx(async (client) => {
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1::text), 8720143)`,
      [userId],
    );

    const existing = await client.query<{ org_id: string }>(
      `SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    if (existing.rows[0]) {
      return { kind: "existing" as const, orgId: existing.rows[0].org_id };
    }

    const seats = getDefaultOrgSeatLimit();
    const orgRes = await client.query<Org>(
      `
      INSERT INTO orgs (name, trial_ends_at, subscription_status, sdk_access_enabled, seat_limit)
      VALUES ($1, NULL, 'active', true, $2)
      RETURNING id, name, created_at, trial_ends_at, stripe_customer_id, subscription_status, sdk_access_enabled, platform_exempt, seat_limit, observe_only_override
    `,
      [trimmedOrg, seats],
    );
    const orgRow = orgRes.rows[0];

    const projRes = await client.query<Project>(
      `
      INSERT INTO projects (org_id, name)
      VALUES ($1, $2)
      RETURNING id, org_id, name, created_at
    `,
      [orgRow.id, projectName.trim() || "Default Project"],
    );
    const projectRow = projRes.rows[0];

    await client.query(
      `INSERT INTO org_memberships (org_id, user_id, role) VALUES ($1, $2, 'OWNER')`,
      [orgRow.id, userId],
    );

    return {
      kind: "created" as const,
      orgRow,
      projectRow,
    };
  });

  if (created.kind === "existing") {
    const org = await getOrgById(created.orgId);
    if (!org) {
      throw new Error("Organization missing for membership");
    }
    const projects = await getOrgProjects(org.id);
    return { status: "existing", org, projects };
  }

  const { orgRow, projectRow } = created;

  const { key, apiKey } = await createApiKey(orgRow.id, null, "Default Key");

  let licenseKey: string | null = null;
  try {
    const lk = `lk_spectyra_${crypto.randomBytes(24).toString("hex")}`;
    const lkPrefix = lk.substring(0, 14);
    const lkHash = await hashApiKey(lk);
    await query(
      `
      INSERT INTO license_keys (org_id, key_hash, key_prefix, device_name)
      VALUES ($1, $2, $3, $4)
    `,
      [orgRow.id, lkHash, lkPrefix, "auto-bootstrap"],
    );
    licenseKey = lk;
  } catch (lkErr: unknown) {
    const msg = lkErr instanceof Error ? lkErr.message : String(lkErr);
    safeLog("warn", "License key generation failed during provisioning", { error: msg });
  }

  await applyPlatformExemptIfBillingListed(userId, orgRow.id);

  if (auditReq) {
    try {
      await audit(auditReq, "ORG_CREATED", {
        targetType: "ORG",
        targetId: orgRow.id,
        metadata: { name: orgRow.name },
      });
      await audit(auditReq, "MEMBER_ADDED", {
        targetType: "ORG_MEMBERSHIP",
        metadata: { role: "OWNER", org_id: orgRow.id },
      });
      await audit(auditReq, "KEY_CREATED", {
        targetType: "API_KEY",
        targetId: apiKey.id,
        metadata: { name: "Default Key", is_bootstrap: true },
      });
      if (licenseKey) {
        await audit(auditReq, "LICENSE_KEY_CREATED", {
          targetType: "LICENSE_KEY",
          metadata: { device_name: "auto-bootstrap", is_bootstrap: true },
        }).catch(() => undefined);
      }
    } catch {
      /* non-fatal */
    }
  }

  const org = await getOrgById(orgRow.id);
  if (!org) {
    throw new Error("Organization not found after provisioning");
  }

  return {
    status: "created",
    org,
    project: projectRow,
    api_key: key,
    api_key_id: apiKey.id,
    license_key: licenseKey,
  };
}
