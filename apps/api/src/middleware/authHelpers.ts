/**
 * Auth Helpers
 * 
 * Utilities for handling dual auth (Supabase JWT + API Key)
 */

import { Request, Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";
import { requireUserSession, requireSpectyraApiKey } from "./auth.js";

/**
 * Try Supabase JWT auth, fallback to API key
 * Attaches org context to req.context for either method
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Try Supabase JWT first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      await requireUserSession(req, res, async () => {
        // If JWT auth succeeds, we need to get org from membership
        if (req.auth?.userId) {
          const { queryOne } = await import("../services/storage/db.js");
          const membership = await queryOne<{ org_id: string; role: string }>(`
            SELECT org_id, role 
            FROM org_memberships 
            WHERE user_id = $1
            LIMIT 1
          `, [req.auth.userId]);

          if (membership) {
            const { getOrgById, getOrgProjects } = await import("../services/storage/orgsRepo.js");
            const org = await getOrgById(membership.org_id);
            if (org) {
              // Attach to context for compatibility - use full Org type
              req.context = {
                org: org, // Use full Org type
                project: null, // Default to org-level
                apiKeyId: '', // Not applicable for JWT
              };
              next();
              return;
            }
          }
        }
        // If we get here, JWT auth succeeded but no org found
        res.status(404).json({ 
          error: "Organization not found",
          needs_bootstrap: true 
        });
      });
      return; // Handled by requireUserSession
    } catch (jwtError) {
      // JWT auth failed, fall through to API key
    }
  }

  // Fall back to API key auth
  await requireSpectyraApiKey(req, res, next);
}
