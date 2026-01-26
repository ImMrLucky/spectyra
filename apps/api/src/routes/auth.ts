/**
 * Authentication Routes
 * 
 * User registration and API key management (without Stripe for now)
 */

import { Router } from "express";
import {
  createOrg,
  getOrgById,
  hasActiveAccess,
  createProject,
  createApiKey,
  getOrgApiKeys,
  deleteApiKey,
  hashApiKey,
  getApiKeyByHash,
  revokeApiKey,
} from "../services/storage/orgsRepo.js";
import { requireSpectyraApiKey, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";

export const authRouter = Router();

/**
 * POST /v1/auth/register
 * 
 * Register a new organization and create default project + API key
 */
authRouter.post("/register", async (req, res) => {
  try {
    const { org_name, project_name } = req.body as { org_name?: string; project_name?: string };
    
    if (!org_name || org_name.trim().length === 0) {
      return res.status(400).json({ error: "Organization name is required" });
    }
    
    // Create org with 7-day trial
    const org = createOrg(org_name.trim(), 7);
    
    // Create default project
    const project = createProject(org.id, project_name || "Default Project");
    
    // Create first API key (org-level, not project-scoped)
    const { key, apiKey } = createApiKey(org.id, null, "Default Key");
    
    res.status(201).json({
      org: {
        id: org.id,
        name: org.name,
        trial_ends_at: org.trial_ends_at,
        subscription_status: org.subscription_status,
      },
      project: {
        id: project.id,
        name: project.name,
      },
      api_key: key, // Only returned once
      api_key_id: apiKey.id,
      message: "Organization created successfully. Save your API key - it won't be shown again!",
    });
  } catch (error: any) {
    safeLog("error", "Registration error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/auth/login
 * 
 * Validate API key and return org/project info
 * (With API keys, "login" is just validating the key)
 */
authRouter.post("/login", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const org = getOrgById(req.context.org.id);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const hasAccess = hasActiveAccess(org);
    
    res.json({
      org: {
        id: org.id,
        name: org.name,
        trial_ends_at: org.trial_ends_at,
        subscription_status: org.subscription_status,
      },
      project: req.context.project,
      has_access: hasAccess,
    });
  } catch (error: any) {
    safeLog("error", "Login error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/auth/me
 * 
 * Get current org/project info (requires auth)
 */
authRouter.get("/me", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const org = getOrgById(req.context.org.id);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const hasAccess = hasActiveAccess(org);
    const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const isTrialActive = trialEnd ? trialEnd > new Date() : false;
    
    res.json({
      org: {
        id: org.id,
        name: org.name,
        trial_ends_at: org.trial_ends_at,
        subscription_status: org.subscription_status,
      },
      project: req.context.project,
      has_access: hasAccess,
      trial_active: isTrialActive,
    });
  } catch (error: any) {
    safeLog("error", "Get org error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/auth/api-keys
 * 
 * Create a new API key (requires auth)
 */
authRouter.post("/api-keys", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { name, project_id } = req.body as { name?: string; project_id?: string };
    const { key, apiKey } = createApiKey(
      req.context.org.id,
      project_id || req.context.project?.id || null,
      name || null
    );
    
    res.json({
      id: apiKey.id,
      key, // Only returned once
      name: apiKey.name,
      project_id: apiKey.project_id,
      created_at: apiKey.created_at,
    });
  } catch (error: any) {
    safeLog("error", "Create API key error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/auth/api-keys
 * 
 * List API keys (requires auth)
 */
authRouter.get("/api-keys", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const keys = getOrgApiKeys(req.context.org.id, false);
    
    // Don't return key hashes, just metadata
    res.json(keys.map(k => ({
      id: k.id,
      name: k.name,
      project_id: k.project_id,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
      revoked_at: k.revoked_at,
    })));
  } catch (error: any) {
    safeLog("error", "List API keys error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * DELETE /v1/auth/api-keys/:id
 * 
 * Revoke an API key (requires auth)
 */
authRouter.delete("/api-keys/:id", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    // Get the key to verify it belongs to this org
    const keyHash = req.params.id; // In this case, id is the key hash
    const apiKey = getApiKeyByHash(keyHash);
    
    if (!apiKey || apiKey.org_id !== req.context.org.id) {
      return res.status(404).json({ error: "API key not found" });
    }
    
    // Revoke the key
    revokeApiKey(keyHash);
    
    res.json({ success: true });
  } catch (error: any) {
    safeLog("error", "Delete API key error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
