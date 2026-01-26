/**
 * Authentication Middleware
 * 
 * Validates X-SPECTYRA-API-KEY header and extracts org/project context.
 * Handles ephemeral X-PROVIDER-KEY header (never stored).
 */

import { Request, Response, NextFunction } from "express";
import { 
  getApiKeyByHash, 
  hashApiKey, 
  updateApiKeyLastUsed,
  getOrgById,
  hasActiveAccess,
  getProjectById,
} from "../services/storage/orgsRepo.js";
import { redactHeaders, safeLog } from "../utils/redaction.js";
import crypto from "node:crypto";

export interface RequestContext {
  org: {
    id: string;
    name: string;
    subscription_status: string;
  };
  project: {
    id: string;
    name: string;
  } | null;
  apiKeyId: string;
  providerKeyOverride?: string;
  providerKeyFingerprint?: string;
}

export interface AuthenticatedRequest extends Request {
  context?: RequestContext;
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * Compute provider key fingerprint for audit
 * Format: SHA256(last6 + org_id + salt)
 */
function computeProviderKeyFingerprint(providerKey: string, orgId: string): string {
  const salt = process.env.PROVIDER_KEY_SALT || "spectyra-audit-salt";
  const last6 = providerKey.slice(-6);
  const input = `${last6}:${orgId}:${salt}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Require Spectyra API Key middleware
 * Validates X-SPECTYRA-API-KEY header and attaches org/project context
 */
export async function requireSpectyraApiKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers["x-spectyra-api-key"] as string | undefined;
    
    if (!apiKey) {
      res.status(401).json({ error: "Missing X-SPECTYRA-API-KEY header" });
      return;
    }
    
    // Hash the key and look it up
    const keyHash = hashApiKey(apiKey);
    const apiKeyRecord = getApiKeyByHash(keyHash);
    
    if (!apiKeyRecord) {
      // Use constant-time comparison even for error to prevent timing attacks
      constantTimeCompare(keyHash, "dummy");
      safeLog("warn", "Invalid API key attempt", { 
        key_prefix: apiKey.substring(0, 12) + "...",
        key_hash_prefix: keyHash.substring(0, 8) + "..."
      });
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    
    // Validate org_id exists
    if (!apiKeyRecord.org_id) {
      safeLog("error", "API key missing org_id", { key_id: apiKeyRecord.id });
      res.status(401).json({ error: "API key is not associated with an organization. Please create a new API key." });
      return;
    }
    
    // Get org
    const org = getOrgById(apiKeyRecord.org_id);
    if (!org) {
      safeLog("error", "Org not found for API key", { 
        key_id: apiKeyRecord.id, 
        org_id: apiKeyRecord.org_id 
      });
      res.status(401).json({ error: "Organization not found" });
      return;
    }
    
    // Check access (trial or subscription)
    // Note: Specific routes may allow estimator/demo mode even if trial expired
    // This is checked per-route, not here
    // For now, we attach org info and let routes decide
    
    // Get project if specified
    let project = null;
    if (apiKeyRecord.project_id) {
      project = getProjectById(apiKeyRecord.project_id);
    }
    
    // Update last used timestamp (async, don't block)
    try {
      updateApiKeyLastUsed(keyHash);
    } catch (error) {
      safeLog("warn", "Failed to update API key last used", { error });
    }
    
    // Attach context to request
    req.context = {
      org: {
        id: org.id,
        name: org.name,
        subscription_status: org.subscription_status,
      },
      project: project ? {
        id: project.id,
        name: project.name,
      } : null,
      apiKeyId: apiKeyRecord.id,
    };
    
    next();
  } catch (error: any) {
    safeLog("error", "Auth middleware error", { error: error.message, headers: redactHeaders(req.headers) });
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Optional provider key middleware
 * Extracts X-PROVIDER-KEY header and stores in request context (never in DB)
 */
export function optionalProviderKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const providerKey = req.headers["x-provider-key"] as string | undefined;
    
    if (providerKey && req.context) {
      // Store in memory only
      req.context.providerKeyOverride = providerKey;
      
      // Compute fingerprint for audit (never the actual key)
      if (req.context.org) {
        req.context.providerKeyFingerprint = computeProviderKeyFingerprint(
          providerKey,
          req.context.org.id
        );
      }
    }
    
    next();
  } catch (error: any) {
    safeLog("error", "Provider key middleware error", { error: error.message });
    next(); // Don't fail request if fingerprint computation fails
  }
}

/**
 * Admin token middleware
 * Validates X-ADMIN-TOKEN header for admin-only endpoints
 */
export function requireAdminToken(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const adminToken = process.env.ADMIN_TOKEN;
  const providedToken = req.headers["x-admin-token"] as string | undefined;
  
  if (!adminToken) {
    safeLog("warn", "Admin token not configured");
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }
  
  if (!providedToken || !constantTimeCompare(providedToken, adminToken)) {
    res.status(403).json({ error: "Invalid admin token" });
    return;
  }
  
  next();
}

/**
 * Legacy authenticate function (for backward compatibility)
 * Maps to requireSpectyraApiKey but maintains old interface
 * @deprecated Use requireSpectyraApiKey instead
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Also check legacy header name for backward compatibility
  const apiKey = (req.headers["x-spectyra-api-key"] || req.headers["x-spectyra-key"]) as string | undefined;
  
  if (apiKey && !req.headers["x-spectyra-api-key"]) {
    req.headers["x-spectyra-api-key"] = apiKey;
  }
  
  return requireSpectyraApiKey(req, res, next);
}
