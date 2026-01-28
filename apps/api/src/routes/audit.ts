/**
 * Audit Logs Routes
 * 
 * Enterprise audit trail for compliance
 */

import { Router } from "express";
import { requireUserSession, requireOrgMembership, type AuthenticatedRequest } from "../middleware/auth.js";
import { requireOrgRole } from "../middleware/requireRole.js";
import { safeLog } from "../utils/redaction.js";
import { query } from "../services/storage/db.js";
import { audit } from "../services/audit/audit.js";

export const auditRouter = Router();

// Apply authentication middleware
auditRouter.use(requireUserSession);
auditRouter.use(requireOrgMembership);

/**
 * GET /v1/audit
 * 
 * Get audit logs for the authenticated org
 */
auditRouter.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Use org from auth context (set by requireOrgMembership)
    const orgId = req.auth?.orgId;
    if (!orgId) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const range = req.query.range as string || "30d";
    const eventType = req.query.event_type as string | undefined;

    // Calculate date range
    const days = range === "24h" ? 1 : range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);

    // Enterprise Security: Query audit_logs table
    const conditions = ["org_id = $1", "created_at >= $2"];
    const params: any[] = [orgId, sinceDate.toISOString()];
    let paramIndex = 3;

    if (eventType) {
      conditions.push(`action = $${paramIndex++}`);
      params.push(eventType);
    }

    const logs = await query<{
      id: string;
      org_id: string;
      project_id: string | null;
      actor_type: string;
      actor_id: string;
      action: string;
      target_type: string | null;
      target_id: string | null;
      ip: string | null;
      user_agent: string | null;
      metadata: string | null;
      created_at: string;
    }>(`
      SELECT id, org_id, project_id, actor_type, actor_id, action, target_type, target_id,
             ip, user_agent, metadata, created_at
      FROM audit_logs
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
      LIMIT 1000
    `, params);

    res.json({
      logs: logs.rows.map(log => ({
        id: log.id,
        org_id: log.org_id,
        project_id: log.project_id,
        actor_type: log.actor_type,
        actor_id: log.actor_id,
        action: log.action,
        target_type: log.target_type,
        target_id: log.target_id,
        ip: log.ip,
        user_agent: log.user_agent,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        created_at: log.created_at,
      })),
      total: logs.rowCount,
    });
  } catch (error: any) {
    safeLog("error", "Get audit logs error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/audit/export
 * 
 * Export audit logs as CSV (OWNER/ADMIN only)
 */
auditRouter.get("/export", requireOrgRole("ADMIN"), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.auth?.userId || !req.auth?.orgId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { from, to } = req.query as { from?: string; to?: string };
    const orgId = req.auth.orgId;

    const conditions = ["org_id = $1"];
    const params: any[] = [orgId];
    let paramIndex = 2;

    if (from) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(to + " 23:59:59");
    }

    const logs = await query<{
      id: string;
      actor_type: string;
      actor_id: string;
      action: string;
      target_type: string | null;
      target_id: string | null;
      ip: string | null;
      created_at: string;
    }>(`
      SELECT id, actor_type, actor_id, action, target_type, target_id, ip, created_at
      FROM audit_logs
      WHERE ${conditions.join(" AND ")}
      ORDER BY created_at DESC
    `, params);

    // Generate CSV
    const csvHeader = "id,actor_type,actor_id,action,target_type,target_id,ip,created_at\n";
    const csvRows = logs.rows.map(log =>
      `${log.id},${log.actor_type},${log.actor_id},${log.action},${log.target_type || ""},${log.target_id || ""},${log.ip || ""},${log.created_at}`
    ).join("\n");

    // Enterprise Security: Audit the export itself
    const { audit } = await import("../services/audit/audit.js");
    await audit(req, "EXPORT_DATA", {
      targetType: "AUDIT_LOG",
      metadata: { from, to, count: logs.rowCount },
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="audit-logs-${orgId}-${Date.now()}.csv"`);
    res.send(csvHeader + csvRows);
  } catch (error: any) {
    safeLog("error", "Export audit logs error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
