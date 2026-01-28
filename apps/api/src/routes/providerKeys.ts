/**
 * Provider Keys Routes
 * 
 * Enterprise Security: Manage encrypted provider credentials (BYOK mode)
 */

import { Router } from "express";
import { requireUserSession, requireOrgMembership, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireOrgRole } from "../middleware/requireRole.js";
import {
  setProviderCredential,
  getProviderCredential,
  listProviderCredentials,
  revokeProviderCredential,
} from "../services/storage/providerCredentialsRepo.js";
import { getOrgSettings, updateOrgSettings } from "../services/storage/settingsRepo.js";
import { audit } from "../services/audit/audit.js";
import { safeLog } from "../utils/redaction.js";

export const providerKeysRouter = Router();

// All routes require authentication and org membership
providerKeysRouter.use(requireUserSession);
providerKeysRouter.use(requireOrgMembership);
providerKeysRouter.use(requireOrgRole("ADMIN")); // OWNER or ADMIN

/**
 * POST /v1/orgs/:orgId/provider-keys
 * 
 * Set or update a provider credential
 */
providerKeysRouter.post("/:orgId/provider-keys", async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.params.orgId;
    const { project_id, provider, key } = req.body as {
      project_id?: string | null;
      provider?: "openai" | "anthropic" | "google" | "azure" | "aws";
      key?: string;
    };

    if (!provider || !key) {
      return res.status(400).json({ error: "provider and key are required" });
    }

    if (!["openai", "anthropic", "google", "azure", "aws"].includes(provider)) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    // Verify org access
    if (req.auth?.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Set credential
    const credential = await setProviderCredential(
      orgId,
      project_id || null,
      provider,
      key
    );

    // Enterprise Security: Audit log
    await audit(req, "PROVIDER_KEY_SET", {
      projectId: project_id || null,
      targetType: "PROVIDER_KEY",
      targetId: credential.id,
      metadata: { provider, project_id: project_id || null },
    });

    res.json({
      id: credential.id,
      provider: credential.provider,
      key_fingerprint: credential.key_fingerprint,
      created_at: credential.created_at,
      // Never return plaintext key
    });
  } catch (error: any) {
    safeLog("error", "Set provider key error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/orgs/:orgId/provider-keys
 * 
 * List provider credentials (masked - no plaintext)
 */
providerKeysRouter.get("/:orgId/provider-keys", async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.params.orgId;
    const { project_id } = req.query as { project_id?: string };

    // Verify org access
    if (req.auth?.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const credentials = await listProviderCredentials(
      orgId,
      project_id || null
    );

    res.json({ credentials });
  } catch (error: any) {
    safeLog("error", "List provider keys error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * DELETE /v1/orgs/:orgId/provider-keys/:id
 * 
 * Revoke a provider credential
 */
providerKeysRouter.delete("/:orgId/provider-keys/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.params.orgId;
    const credentialId = req.params.id;

    // Verify org access
    if (req.auth?.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    await revokeProviderCredential(credentialId, orgId);

    // Enterprise Security: Audit log
    await audit(req, "PROVIDER_KEY_REVOKED", {
      targetType: "PROVIDER_KEY",
      targetId: credentialId,
    });

    res.json({ success: true });
  } catch (error: any) {
    safeLog("error", "Revoke provider key error", { error: error.message });
    if (error.message.includes("not found")) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PATCH /v1/orgs/:orgId/provider-key-mode
 * 
 * Update provider key mode (BYOK_ONLY, VAULT_ONLY, EITHER)
 */
providerKeysRouter.patch("/:orgId/provider-key-mode", async (req: AuthenticatedRequest, res) => {
  try {
    const orgId = req.params.orgId;
    const { provider_key_mode } = req.body as {
      provider_key_mode?: "BYOK_ONLY" | "VAULT_ONLY" | "EITHER";
    };

    if (!provider_key_mode) {
      return res.status(400).json({ error: "provider_key_mode is required" });
    }

    if (!["BYOK_ONLY", "VAULT_ONLY", "EITHER"].includes(provider_key_mode)) {
      return res.status(400).json({ error: "Invalid provider_key_mode" });
    }

    // Verify org access
    if (req.auth?.orgId !== orgId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const settings = await updateOrgSettings(orgId, { provider_key_mode });

    // Enterprise Security: Audit log
    await audit(req, "SETTINGS_UPDATED", {
      targetType: "ORG_SETTINGS",
      targetId: orgId,
      metadata: { field: "provider_key_mode", value: provider_key_mode },
    });

    res.json({ settings });
  } catch (error: any) {
    safeLog("error", "Update provider key mode error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
