/**
 * Authentication Middleware (Postgres + Supabase)
 * 
 * ============================================================================
 * AUTHENTICATION FLOW DOCUMENTATION (Enterprise Security Audit)
 * ============================================================================
 * 
 * Two authentication methods:
 * 1. Human auth: Supabase JWT (for dashboard)
 *    - Routes: requireUserSession middleware
 *    - Used by: /auth/* (bootstrap, api-keys), /runs, /usage, /policies, /audit, /admin
 *    - Sets: req.auth.userId, req.context.userId, req.context.org (via org_memberships)
 *    - Org inference: From org_memberships table (user_id -> org_id)
 * 
 * 2. Machine auth: Spectyra API key with argon2id (for gateway/SDK)
 *    - Routes: requireSpectyraApiKey middleware
 *    - Used by: /chat, /agent/*, /replay, /proof, /auth/login (legacy)
 *    - Sets: req.context.org.id, req.context.project.id, req.context.apiKeyId
 *    - Org inference: From api_keys table (key -> org_id, project_id)
 * 
 * RequestContext (Single Source of Truth):
 * - req.context.org.id: ALWAYS set for authenticated requests
 * - req.context.project.id: Set if API key is project-scoped, null otherwise
 * - req.context.userId: Set for JWT auth
 * - req.context.apiKeyId: Set for API key auth
 * - req.context.userRole: Set for JWT auth (from org_memberships.role)
 * 
 * Tenant Isolation:
 * - All queries MUST filter by req.context.org.id
 * - Project-scoped queries MUST filter by req.context.project.id AND verify org_id matches
 * - NEVER trust client-provided org_id or project_id in request body/params
 * 
 * Handles ephemeral X-PROVIDER-KEY header (never stored, BYOK mode).
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
import type { Org, Project } from "@spectyra/shared";
import type { SupabaseAdminUser } from "../types/supabase.js";

export interface RequestContext {
  org: Org;
  project: Project | null;
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

    // Enterprise Security: Check key expiration
    if (apiKeyRecord.expires_at) {
      const expiresAt = new Date(apiKeyRecord.expires_at);
      if (expiresAt < new Date()) {
        safeLog("warn", "Expired API key attempt", {
          key_id: apiKeyRecord.id,
          key_prefix: keyPrefix,
          expires_at: apiKeyRecord.expires_at,
        });
        res.status(401).json({ error: "API key has expired" });
        return;
      }
    }

    // Enterprise Security: Check IP restrictions
    if (apiKeyRecord.allowed_ip_ranges && apiKeyRecord.allowed_ip_ranges.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || "";
      const ipAllowed = apiKeyRecord.allowed_ip_ranges.some((range) => {
        // Simple CIDR check (for MVP, can enhance with proper CIDR library)
        if (range.includes("/")) {
          // Basic CIDR check - for production, use a proper CIDR library
          const [network, prefix] = range.split("/");
          // Simplified check - in production, use ipaddr.js or similar
          return clientIp.startsWith(network.split(".").slice(0, parseInt(prefix) / 8).join("."));
        }
        return clientIp === range;
      });

      if (!ipAllowed) {
        safeLog("warn", "API key IP restriction violation", {
          key_id: apiKeyRecord.id,
          client_ip: clientIp,
          allowed_ranges: apiKeyRecord.allowed_ip_ranges,
        });
        res.status(403).json({ error: "API key not allowed from this IP address" });
        return;
      }
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
      org: org, // Use full Org type
      project: project, // Use full Project type
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
 * 
 * Enterprise Security: Enforces BYOK mode based on org_settings.provider_key_mode
 */
export async function optionalProviderKey(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const providerKey = req.headers["x-provider-key"] as string | undefined;
    
    // Get orgId from either req.context.org.id or req.auth.orgId
    const orgId = req.context?.org?.id ?? req.auth?.orgId;
    
    if (!orgId) {
      // If no org context, allow provider key (will be checked later)
      if (providerKey && req.context) {
        req.context.providerKeyOverride = providerKey;
      }
      next();
      return;
    }

    // Get org settings to check provider_key_mode
    const { getOrgSettings } = await import("../services/storage/settingsRepo.js");
    const orgSettings = await getOrgSettings(orgId);

    // Enforce BYOK mode
    if (orgSettings.provider_key_mode === "BYOK_ONLY") {
      if (!providerKey) {
        res.status(400).json({
          error: "Provider key required",
          message: "This organization requires BYOK (Bring Your Own Key) mode. Please provide X-PROVIDER-KEY header.",
        });
        return;
      }
    } else if (orgSettings.provider_key_mode === "VAULT_ONLY") {
      if (providerKey) {
        res.status(400).json({
          error: "Provider key not allowed",
          message: "This organization uses vaulted keys only. Do not provide X-PROVIDER-KEY header.",
        });
        return;
      }
    }
    // EITHER mode: allow both

    if (providerKey) {
      // Store in memory only
      if (req.context) {
        req.context.providerKeyOverride = providerKey;
      }
      if (req.auth) {
        req.auth.providerKeyOverride = providerKey;
      }

      // Compute fingerprint for audit (if we have org_id)
      // Reuse orgId computed at the top of the function
      if (orgId) {
        const fingerprint = computeProviderKeyFingerprint(providerKey, orgId);
        if (req.auth) {
          req.auth.providerKeyFingerprint = fingerprint;
        }
        if (req.context) {
          req.context.providerKeyFingerprint = fingerprint;
        }
      }
    }

    next();
  } catch (error: any) {
    safeLog("error", "Provider key middleware error", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
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
    
    // Enterprise Security: Check domain allowlist and SSO enforcement
    try {
      const { getOrgSettings } = await import("../services/storage/settingsRepo.js");
      const orgSettings = await getOrgSettings(orgId);

      // Check domain allowlist
      if (orgSettings.allowed_email_domains && orgSettings.allowed_email_domains.length > 0) {
        // Get user email from Supabase (if available)
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseServiceKey) {
          try {
            const response = await fetch(
              `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${req.auth.userId}`,
              {
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'apikey': supabaseServiceKey,
                },
              }
            );

            if (response.ok) {
              const user = await response.json() as SupabaseAdminUser;
              const userEmail = user.email || user.user_metadata?.email;
              
              if (userEmail) {
                const userDomain = userEmail.split('@')[1]?.toLowerCase();
                const allowedDomains = orgSettings.allowed_email_domains.map((d: string) => d.toLowerCase());
                
                if (!allowedDomains.includes(userDomain)) {
                  safeLog("warn", "Domain not allowed", {
                    userId: req.auth.userId,
                    userEmail,
                    userDomain,
                    allowedDomains,
                  });
                  res.status(403).json({
                    error: "Access denied",
                    message: `Your email domain is not allowed for this organization. Allowed domains: ${allowedDomains.join(", ")}`,
                  });
                  return;
                }
              }
            }
          } catch (error) {
            // If we can't check email, allow access (fail open for now)
            safeLog("warn", "Could not verify email domain", { error });
          }
        }
      }

      // Check SSO enforcement (if enabled, verify user has SSO provider)
      if (orgSettings.enforce_sso) {
        // Get user from Supabase to check SSO provider
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        
        if (supabaseUrl && supabaseServiceKey) {
          try {
            const response = await fetch(
              `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${req.auth.userId}`,
              {
                headers: {
                  'Authorization': `Bearer ${supabaseServiceKey}`,
                  'apikey': supabaseServiceKey,
                },
              }
            );

            if (response.ok) {
              const user = await response.json() as SupabaseAdminUser;
              const appMetadata = user.app_metadata || {};
              const provider = appMetadata.provider || user.user_metadata?.provider;
              
              // Check if user authenticated via SSO provider
              // Supabase SSO providers: 'saml', 'okta', 'azure', 'google', etc.
              const ssoProviders = ['saml', 'okta', 'azure', 'google', 'auth0', 'onelogin'];
              const isSsoUser = (provider && ssoProviders.includes(provider)) || 
                               appMetadata.providers?.some((p: string) => ssoProviders.includes(p));
              
              if (!isSsoUser) {
                safeLog("warn", "SSO enforcement violation", {
                  userId: req.auth.userId,
                  orgId,
                  userProvider: provider,
                  appMetadata,
                });
                res.status(403).json({
                  error: "SSO required",
                  message: "This organization requires SSO (Single Sign-On) authentication. Please sign in using your organization's SSO provider.",
                });
                return;
              }
              
              safeLog("info", "SSO user verified", {
                userId: req.auth.userId,
                orgId,
                provider,
              });
            } else {
              // If we can't verify SSO, allow access (fail open for now)
              safeLog("warn", "Could not verify SSO status", {
                userId: req.auth.userId,
                orgId,
                status: response.status,
              });
            }
          } catch (error) {
            // If SSO check fails, allow access (fail open)
            safeLog("warn", "SSO verification error", {
              userId: req.auth.userId,
              orgId,
              error,
            });
          }
        } else {
          safeLog("warn", "SSO enforcement enabled but Supabase config missing", { orgId });
        }
      }
    } catch (error) {
      // If settings check fails, allow access (fail open)
      safeLog("warn", "Could not check org settings for SSO/domain", { error });
    }

    // Attach org info
    req.auth.orgId = orgId;
    req.auth.role = membership.role;
    
    // Attach to context - load full org
    req.context = req.context || {} as RequestContext;
    const org = await getOrgById(orgId);
    if (org) {
      req.context.org = org; // Use full Org type
    } else {
      // Fallback: create minimal org (shouldn't happen, but type-safe)
      req.context.org = {
        id: orgId,
        name: "",
        created_at: new Date().toISOString(),
        trial_ends_at: null,
        stripe_customer_id: null,
        subscription_status: "trial",
        sdk_access_enabled: false,
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
 * Owner check middleware
 * Validates that the authenticated user is the owner (gkh1974@gmail.com)
 * Must be used after requireUserSession
 */
export async function requireOwner(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.auth?.userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const ownerEmail = process.env.OWNER_EMAIL || "gkh1974@gmail.com";
    
    // Get user email from Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    if (!supabaseUrl) {
      safeLog("error", "SUPABASE_URL not configured");
      res.status(503).json({ error: "Authentication not configured" });
      return;
    }

    const { queryOne } = await import("../services/storage/db.js");
    
    // Query Supabase auth.users table via service role
    // Note: This requires Supabase service role key
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceKey) {
      // Fallback: check if we can get email from JWT payload
      // The JWT should contain email in user_metadata
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.substring(7);
        try {
          // Decode JWT without verification (we already verified it)
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            const userEmail = payload.email || payload.user_metadata?.email;
            
            if (userEmail && userEmail.toLowerCase() === ownerEmail.toLowerCase()) {
              safeLog("info", "Owner access granted", { email: userEmail });
              next();
              return;
            }
          }
        } catch (e) {
          // Fall through to error
        }
      }
      
      safeLog("warn", "SUPABASE_SERVICE_ROLE_KEY not configured, cannot verify owner");
      res.status(503).json({ error: "Owner verification not configured" });
      return;
    }

    // Use Supabase Admin API to get user email
    try {
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${req.auth.userId}`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
          },
        }
      );

      if (!response.ok) {
        safeLog("warn", "Failed to fetch user from Supabase", { 
          status: response.status,
          userId: req.auth.userId 
        });
        res.status(403).json({ error: "Access denied" });
        return;
      }

      const user = await response.json() as SupabaseAdminUser;
      const userEmail = user.email || user.user_metadata?.email;

      if (!userEmail || userEmail.toLowerCase() !== ownerEmail.toLowerCase()) {
        safeLog("warn", "Non-owner access attempt", { 
          email: userEmail,
          userId: req.auth.userId 
        });
        res.status(403).json({ error: "Access denied: Owner only" });
        return;
      }

      safeLog("info", "Owner access granted", { email: userEmail });
      next();
    } catch (error: any) {
      safeLog("error", "Owner check error", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  } catch (error: any) {
    safeLog("error", "Owner middleware error", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Admin token middleware (legacy, kept for backward compatibility)
 * Validates X-ADMIN-TOKEN header for admin-only endpoints
 * @deprecated Use requireOwner instead
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
 * SDK Access Check Middleware
 * Validates that the organization has SDK access enabled
 * Must be used after requireSpectyraApiKey
 */
export async function requireSdkAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.context?.org?.id) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { queryOne } = await import("../services/storage/db.js");
    const org = await queryOne<{ sdk_access_enabled: boolean }>(`
      SELECT sdk_access_enabled FROM orgs WHERE id = $1
    `, [req.context.org.id]);

    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    if (!org.sdk_access_enabled) {
      safeLog("warn", "SDK access denied", { 
        orgId: req.context.org.id,
        orgName: req.context.org.name 
      });
      res.status(403).json({ 
        error: "SDK access is disabled for this organization",
        message: "Please contact support to enable SDK access"
      });
      return;
    }

    next();
  } catch (error: any) {
    safeLog("error", "SDK access check error", { error: error.message });
    res.status(500).json({ error: "Internal server error" });
  }
}
