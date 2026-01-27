/**
 * Authentication Middleware (Postgres + Supabase)
 * 
 * Two authentication methods:
 * 1. Human auth: Supabase JWT (for dashboard)
 * 2. Machine auth: Project API key with argon2id (for gateway/SDK)
 * 
 * Handles ephemeral X-PROVIDER-KEY header (never stored).
 */

import { Request, Response, NextFunction } from "express";
import { 
  getApiKeyByPrefix,
  getApiKeyByHash,
  verifyApiKey,
  updateApiKeyLastUsed,
  getOrgById,
  hasActiveAccess,
  getProjectById,
} from "../services/storage/orgsRepo.js";
import { redactHeaders, safeLog } from "../utils/redaction.js";
import crypto from "node:crypto";
import { jwtVerify, createRemoteJWKSet } from "jose";

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
  // For Supabase JWT auth
  userId?: string;
  userRole?: string;
}

export interface AuthenticatedRequest extends Request {
  context?: RequestContext;
  auth?: {
    userId?: string;
    orgId?: string;
    projectId?: string | null;
    role?: string;
    scopes?: string[];
    apiKeyId?: string;
    providerKeyOverride?: string;
    providerKeyFingerprint?: string;
  };
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
 * Require Spectyra API Key middleware (Machine Auth)
 * Validates X-SPECTYRA-API-KEY header using prefix lookup + argon2id verification
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
    
    // Extract prefix (first 12 chars: "sk_spectyra_")
    const keyPrefix = apiKey.substring(0, 12);
    
    // Lookup by prefix for fast retrieval
    const apiKeyRecord = await getApiKeyByPrefix(keyPrefix);
    
    if (!apiKeyRecord) {
      // Use constant-time comparison even for error to prevent timing attacks
      constantTimeCompare(keyPrefix, "dummy");
      safeLog("warn", "Invalid API key attempt", { 
        key_prefix: keyPrefix,
      });
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    
    // Verify the full key hash with argon2id
    const isValid = await verifyApiKey(apiKey, apiKeyRecord.key_hash);
    if (!isValid) {
      constantTimeCompare(keyPrefix, "dummy");
      safeLog("warn", "API key verification failed", { 
        key_id: apiKeyRecord.id,
        key_prefix: keyPrefix,
      });
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    
    // Get org
    const org = await getOrgById(apiKeyRecord.org_id);
    if (!org) {
      safeLog("error", "Org not found for API key", { 
        key_id: apiKeyRecord.id, 
        org_id: apiKeyRecord.org_id 
      });
      res.status(401).json({ error: "Organization not found" });
      return;
    }
    
    // Get project if specified
    let project = null;
    if (apiKeyRecord.project_id) {
      project = await getProjectById(apiKeyRecord.project_id);
    }
    
    // Update last used timestamp (async, don't block)
    updateApiKeyLastUsed(apiKeyRecord.key_hash).catch((error) => {
      safeLog("warn", "Failed to update API key last used", { error });
    });
    
    // Attach context to request (legacy format for backward compatibility)
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
    
    // Also attach to req.auth (new format)
    req.auth = {
      orgId: org.id,
      projectId: apiKeyRecord.project_id,
      scopes: apiKeyRecord.scopes || [],
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
  const providerKey = req.headers["x-provider-key"] as string | undefined;
  
  if (providerKey) {
    // Store in memory only
    if (req.context) {
      req.context.providerKeyOverride = providerKey;
    }
    if (req.auth) {
      req.auth.providerKeyOverride = providerKey;
      
      // Compute fingerprint for audit (if we have org_id)
      if (req.auth.orgId) {
        req.auth.providerKeyFingerprint = computeProviderKeyFingerprint(
          providerKey,
          req.auth.orgId
        );
        if (req.context) {
          req.context.providerKeyFingerprint = req.auth.providerKeyFingerprint;
        }
      }
    }
  }
  
  next();
}

/**
 * Require Supabase JWT (Human Auth)
 * Validates Authorization: Bearer <jwt> header
 * Extracts user_id from JWT claims
 */
export async function requireUserSession(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    // Verify JWT using Supabase JWKS
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      safeLog("error", "SUPABASE_URL not configured");
      res.status(503).json({ error: "Authentication not configured" });
      return;
    }
    
    // Ensure supabaseUrl doesn't have trailing slash
    const cleanSupabaseUrl = supabaseUrl.replace(/\/$/, '');
    
    // Supabase JWKS endpoint is at /auth/v1/.well-known/jwks.json
    const jwksUrl = `${cleanSupabaseUrl}/auth/v1/.well-known/jwks.json`;
    
    try {
      const JWKS = createRemoteJWKSet(new URL(jwksUrl));
      
      // Supabase JWT issuer can be either the full URL or just the domain
      // Try both formats for compatibility, and also try without issuer check
      const issuerOptions = [
        cleanSupabaseUrl, // Full URL: https://project.supabase.co
        cleanSupabaseUrl.replace(/^https?:\/\//, ''), // Domain only: project.supabase.co
      ];
      
      let verified = false;
      let payload: any = null;
      let lastError: any = null;
      
      // Try with issuer validation first
      for (const issuer of issuerOptions) {
        try {
          const result = await jwtVerify(token, JWKS, {
            issuer: issuer,
            audience: "authenticated",
          });
          payload = result.payload;
          verified = true;
          safeLog("info", "JWT verified successfully", { issuer, userId: payload.sub });
          break;
        } catch (err: any) {
          lastError = err;
          // Try next issuer format
        }
      }
      
      // If issuer validation failed, try without issuer check (some Supabase configs don't set it)
      if (!verified) {
        try {
          const result = await jwtVerify(token, JWKS, {
            audience: "authenticated",
            // Don't check issuer - some Supabase projects don't set it correctly
          });
          payload = result.payload;
          verified = true;
          safeLog("info", "JWT verified without issuer check", { userId: payload.sub });
        } catch (err: any) {
          lastError = err;
        }
      }
      
      if (!verified || !payload) {
        // Check if it's a JWKS fetch error
        const isJwksError = lastError?.message?.includes('Expected 200 OK') || 
                           lastError?.message?.includes('JWKS') ||
                           lastError?.code === 'ECONNREFUSED' ||
                           lastError?.code === 'ENOTFOUND';
        
        if (isJwksError) {
          safeLog("error", "JWKS endpoint not accessible", { 
            error: lastError?.message,
            jwksUrl: jwksUrl,
            supabaseUrl: cleanSupabaseUrl,
            hint: "Check if SUPABASE_URL is correct and Supabase project is active. JWKS should be at /auth/v1/.well-known/jwks.json"
          });
          res.status(503).json({ 
            error: "Authentication service unavailable",
            details: process.env.NODE_ENV !== 'production' 
              ? `Cannot reach JWKS endpoint: ${lastError?.message}` 
              : undefined
          });
          return;
        }
        
        safeLog("warn", "JWT verification failed", { 
          error: lastError?.message || "Unknown error",
          errorCode: lastError?.code,
          supabaseUrl: cleanSupabaseUrl,
          triedIssuers: issuerOptions,
          tokenPreview: token.substring(0, 20) + "..."
        });
        res.status(401).json({ 
          error: "Invalid or expired token",
          details: process.env.NODE_ENV !== 'production' ? lastError?.message : undefined
        });
        return;
      }
      
      const userId = payload.sub as string;
      if (!userId) {
        safeLog("warn", "JWT missing user ID", { payload: Object.keys(payload) });
        res.status(401).json({ error: "Invalid token: missing user ID" });
        return;
      }
      
      // Attach user info to request
      req.auth = req.auth || {};
      req.auth.userId = userId;
      
      // Also attach to context for backward compatibility
      req.context = req.context || {} as RequestContext;
      req.context.userId = userId;
      
      next();
    } catch (jwtError: any) {
      safeLog("error", "JWT verification error", { 
        error: jwtError.message,
        stack: jwtError.stack,
        supabaseUrl 
      });
      res.status(401).json({ 
        error: "Invalid or expired token",
        details: process.env.NODE_ENV === 'development' ? jwtError.message : undefined
      });
      return;
    }
  } catch (error: any) {
    safeLog("error", "User session middleware error", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Require org membership (for dashboard routes)
 * Must be used after requireUserSession
 * Checks that user is a member of the specified org
 */
export async function requireOrgMembership(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    
    // Get org_id from route param, query param, or header
    const orgId = req.params.orgId || req.query.org_id as string || req.headers["x-org-id"] as string;
    
    if (!orgId) {
      res.status(400).json({ error: "Organization ID required" });
      return;
    }
    
    // Check membership
    const { queryOne } = await import("../services/storage/db.js");
    const membership = await queryOne<{ role: string }>(`
      SELECT role 
      FROM org_memberships 
      WHERE org_id = $1 AND user_id = $2
    `, [orgId, req.auth.userId]);
    
    if (!membership) {
      res.status(403).json({ error: "Not a member of this organization" });
      return;
    }
    
    // Attach org info
    req.auth.orgId = orgId;
    req.auth.role = membership.role;
    
    // Also attach to context
    req.context = req.context || {} as RequestContext;
    const org = await getOrgById(orgId);
    if (org) {
      req.context.org = {
        id: org.id,
        name: org.name,
        subscription_status: org.subscription_status,
      };
    }
    req.context.userRole = membership.role;
    
    next();
  } catch (error: any) {
    safeLog("error", "Org membership middleware error", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
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
