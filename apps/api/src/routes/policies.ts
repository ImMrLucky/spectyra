/**
 * Policies Routes
 * 
 * Policy governance for runtime control
 */

import { Router } from "express";
import { requireUserSession, type AuthenticatedRequest } from "../middleware/auth.js";
import { safeLog } from "../utils/redaction.js";
import { query, queryOne } from "../services/storage/db.js";

export const policiesRouter = Router();

// Apply authentication middleware
policiesRouter.use(requireUserSession);

/**
 * GET /v1/policies
 * 
 * List all policies for the authenticated org
 */
policiesRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's org
    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // TODO: Implement policies table and query
    // For now, return empty array
    res.json([]);
  } catch (error: any) {
    safeLog("error", "Get policies error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/policies
 * 
 * Create a new policy
 */
policiesRouter.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get user's org
    const membership = await queryOne<{ org_id: string }>(`
      SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
    `, [req.auth.userId]);

    if (!membership) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const { name, type, config, project_id } = req.body;

    // TODO: Implement policies table and insert
    // For now, return success
    res.status(201).json({
      id: "policy_" + Date.now(),
      name,
      type,
      config,
      enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    safeLog("error", "Create policy error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * PUT /v1/policies/:id
 * 
 * Update a policy
 */
policiesRouter.put("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // TODO: Implement policy update
    res.json({ success: true });
  } catch (error: any) {
    safeLog("error", "Update policy error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/policies/top-triggered
 * 
 * Get top triggered policies (for Overview page)
 */
policiesRouter.get("/top-triggered", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // TODO: Implement policy trigger tracking
    // For now, return empty array
    res.json([]);
  } catch (error: any) {
    safeLog("error", "Get top policies error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
