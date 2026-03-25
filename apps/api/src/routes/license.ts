/**
 * License Key Routes
 *
 * Generates and validates offline-capable license keys for
 * the Desktop App and Local Companion.
 *
 * License keys are distinct from API keys:
 *  - API keys authenticate machine-to-cloud requests.
 *  - License keys validate entitlement state without a constant network
 *    connection — the Desktop App / Companion caches the last-known
 *    entitlement and re-validates periodically.
 */

import { Router } from "express";
import crypto from "node:crypto";
import { hashApiKey, verifyApiKey } from "../services/storage/orgsRepo.js";
import { query, queryOne } from "../services/storage/db.js";
import { requireUserSession, requireOrgMembership, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireOrgRole } from "../middleware/requireRole.js";
import { getEntitlement } from "../services/entitlement.js";
import { audit } from "../services/audit/audit.js";
import { safeLog } from "../utils/redaction.js";

export const licenseRouter = Router();

function generateLicenseKey(): string {
  const random = crypto.randomBytes(24).toString("hex");
  return `lk_spectyra_${random}`;
}

/**
 * POST /v1/license/generate
 * Create a new license key for the Desktop App / Local Companion.
 * Requires OWNER or ADMIN role.
 */
licenseRouter.post(
  "/generate",
  requireUserSession,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await queryOne<{ org_id: string; role: string }>(`
        SELECT org_id, role FROM org_memberships WHERE user_id = $1 LIMIT 1
      `, [req.auth.userId]);

      if (!membership) {
        return res.status(404).json({ error: "Organization not found" });
      }

      if (!["OWNER", "ADMIN"].includes(membership.role)) {
        return res.status(403).json({ error: "Only owners and admins can generate license keys" });
      }

      const { device_name } = req.body as { device_name?: string };

      const key = generateLicenseKey();
      const keyPrefix = key.substring(0, 14);
      const keyHash = await hashApiKey(key);

      await query(`
        INSERT INTO license_keys (org_id, key_hash, key_prefix, device_name)
        VALUES ($1, $2, $3, $4)
      `, [membership.org_id, keyHash, keyPrefix, device_name || null]);

      await audit(req, "LICENSE_KEY_CREATED", {
        targetType: "LICENSE_KEY",
        metadata: { device_name: device_name || null },
      }).catch(() => {});

      res.status(201).json({
        license_key: key,
        key_prefix: keyPrefix,
        device_name: device_name || null,
        message: "Save this license key — it will not be shown again.",
      });
    } catch (error: any) {
      safeLog("error", "License key generation error", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * POST /v1/license/validate
 * Validates a license key and returns current entitlement info.
 * Called by the Desktop App / Local Companion on startup and
 * periodically to refresh cached entitlement state.
 */
licenseRouter.post("/validate", async (req, res) => {
  try {
    const { license_key } = req.body as { license_key?: string };

    if (!license_key || !license_key.startsWith("lk_spectyra_")) {
      return res.status(400).json({ error: "Invalid license key format" });
    }

    const keyPrefix = license_key.substring(0, 14);

    const record = await queryOne<{
      id: string;
      org_id: string;
      key_hash: string;
      revoked_at: string | null;
      expires_at: string | null;
    }>(`
      SELECT id, org_id, key_hash, revoked_at, expires_at
      FROM license_keys
      WHERE key_prefix = $1
    `, [keyPrefix]);

    if (!record) {
      return res.status(401).json({ error: "Invalid license key" });
    }

    const isValid = await verifyApiKey(license_key, record.key_hash);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid license key" });
    }

    if (record.revoked_at) {
      return res.status(403).json({ error: "License key has been revoked" });
    }

    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return res.status(403).json({ error: "License key has expired" });
    }

    await query(`
      UPDATE license_keys SET last_validated_at = now() WHERE id = $1
    `, [record.id]);

    const entitlement = await getEntitlement(record.org_id);

    res.json({
      valid: true,
      entitlement,
    });
  } catch (error: any) {
    safeLog("error", "License key validation error", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /v1/license/keys
 * List license keys for the authenticated user's org.
 */
licenseRouter.get(
  "/keys",
  requireUserSession,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await queryOne<{ org_id: string }>(`
        SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
      `, [req.auth.userId]);

      if (!membership) {
        return res.status(404).json({ error: "Organization not found" });
      }

      const result = await query<{
        id: string;
        key_prefix: string;
        device_name: string | null;
        created_at: string;
        last_validated_at: string | null;
        revoked_at: string | null;
      }>(`
        SELECT id, key_prefix, device_name, created_at, last_validated_at, revoked_at
        FROM license_keys
        WHERE org_id = $1
        ORDER BY created_at DESC
      `, [membership.org_id]);

      res.json(result.rows);
    } catch (error: any) {
      safeLog("error", "List license keys error", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

/**
 * DELETE /v1/license/keys/:id
 * Revoke a license key.
 */
licenseRouter.delete(
  "/keys/:id",
  requireUserSession,
  async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.auth?.userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const membership = await queryOne<{ org_id: string; role: string }>(`
        SELECT org_id, role FROM org_memberships WHERE user_id = $1 LIMIT 1
      `, [req.auth.userId]);

      if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
        return res.status(403).json({ error: "Only owners and admins can revoke license keys" });
      }

      const keyId = req.params.id;

      const key = await queryOne<{ org_id: string }>(`
        SELECT org_id FROM license_keys WHERE id = $1
      `, [keyId]);

      if (!key || key.org_id !== membership.org_id) {
        return res.status(404).json({ error: "License key not found" });
      }

      await query(`
        UPDATE license_keys SET revoked_at = now() WHERE id = $1
      `, [keyId]);

      await audit(req, "LICENSE_KEY_REVOKED", {
        targetType: "LICENSE_KEY",
        targetId: keyId,
      }).catch(() => {});

      res.json({ success: true });
    } catch (error: any) {
      safeLog("error", "Revoke license key error", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  }
);
