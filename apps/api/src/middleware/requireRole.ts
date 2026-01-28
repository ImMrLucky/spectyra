/**
 * RBAC (Role-Based Access Control) Middleware
 * 
 * Enterprise Security: Enforces role-based permissions for dashboard routes
 * 
 * Roles (ordered by privilege):
 * - OWNER: Full control (delete org, manage members, all settings)
 * - ADMIN: Manage settings, members, API keys (cannot delete org)
 * - DEV: Create/manage projects, API keys, runs
 * - BILLING: View billing, usage (read-only for most resources)
 * - VIEWER: Read-only access
 * 
 * Usage:
 *   requireOrgRole('ADMIN') // Requires ADMIN or higher (OWNER)
 *   requireOrgRole('VIEWER') // Requires any role (allows all)
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";
import { queryOne } from "../services/storage/db.js";
import { safeLog } from "../utils/redaction.js";

export type Role = "OWNER" | "ADMIN" | "DEV" | "BILLING" | "VIEWER";

const ROLE_HIERARCHY: Record<Role, number> = {
  OWNER: 5,
  ADMIN: 4,
  DEV: 3,
  BILLING: 2,
  VIEWER: 1,
};

/**
 * Get role hierarchy value
 */
function getRoleValue(role: Role): number {
  return ROLE_HIERARCHY[role] || 0;
}

/**
 * Check if user role meets minimum requirement
 */
function hasMinimumRole(userRole: Role, minRole: Role): boolean {
  return getRoleValue(userRole) >= getRoleValue(minRole);
}

/**
 * Require minimum org role
 * Must be used after requireUserSession + requireOrgMembership
 * 
 * @param minRole Minimum role required (OWNER, ADMIN, DEV, BILLING, VIEWER)
 */
export function requireOrgRole(minRole: Role) {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.auth?.userId || !req.auth?.orgId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      // Get user's role in the org
      const membership = await queryOne<{ role: Role }>(`
        SELECT role 
        FROM org_memberships 
        WHERE org_id = $1 AND user_id = $2
      `, [req.auth.orgId, req.auth.userId]);

      if (!membership) {
        res.status(403).json({ error: "Not a member of this organization" });
        return;
      }

      const userRole = membership.role as Role;

      if (!hasMinimumRole(userRole, minRole)) {
        safeLog("warn", "Insufficient role for action", {
          userId: req.auth.userId,
          orgId: req.auth.orgId,
          userRole,
          requiredRole: minRole,
        });
        res.status(403).json({
          error: "Insufficient permissions",
          message: `This action requires ${minRole} role or higher. Your role: ${userRole}`,
        });
        return;
      }

      // Attach role to context
      req.auth.role = userRole;
      if (req.context) {
        req.context.userRole = userRole;
      }

      next();
    } catch (error: any) {
      safeLog("error", "Role check error", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

/**
 * Require API key scope
 * Must be used after requireSpectyraApiKey
 * 
 * @param requiredScopes Array of required scopes (all must be present)
 */
export function requireScope(requiredScopes: string[]) {
  return (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      if (!req.auth?.scopes) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const keyScopes = req.auth.scopes || [];
      const hasAllScopes = requiredScopes.every((scope) =>
        keyScopes.includes(scope)
      );

      if (!hasAllScopes) {
        safeLog("warn", "Insufficient scopes for action", {
          apiKeyId: req.auth.apiKeyId,
          keyScopes,
          requiredScopes,
        });
        res.status(403).json({
          error: "Insufficient scopes",
          message: `This action requires scopes: ${requiredScopes.join(", ")}`,
          required: requiredScopes,
          granted: keyScopes,
        });
        return;
      }

      next();
    } catch (error: any) {
      safeLog("error", "Scope check error", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  };
}
