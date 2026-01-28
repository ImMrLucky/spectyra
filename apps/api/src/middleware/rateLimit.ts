/**
 * Rate Limiting Middleware
 * 
 * Enterprise Security: Token bucket rate limiting per org/project/API key
 * 
 * Uses in-memory token bucket for MVP. For production scale, use Redis.
 */

import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "./auth.js";
import { getProjectSettings, getOrgSettings } from "../services/storage/settingsRepo.js";
import { safeLog } from "../utils/redaction.js";

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per second
}

// In-memory token buckets (keyed by org_id:project_id:apiKeyId or org_id:userId)
const buckets = new Map<string, TokenBucket>();

// Cleanup old buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 10 * 60 * 1000; // 10 minutes
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefill > maxAge) {
      buckets.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Refill tokens in bucket
 */
function refillBucket(bucket: TokenBucket): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000; // seconds
  const tokensToAdd = elapsed * bucket.refillRate;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

/**
 * Get or create token bucket for a key
 */
function getBucket(key: string, capacity: number, refillRate: number): TokenBucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = {
      tokens: capacity, // Start full
      lastRefill: Date.now(),
      capacity,
      refillRate,
    };
    buckets.set(key, bucket);
  } else {
    refillBucket(bucket);
  }
  return bucket;
}

/**
 * Rate limit middleware
 * Uses project_settings for limits, falls back to org defaults
 */
export async function rateLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const context = req.context || req.auth;
    if (!context) {
      // No auth context, skip rate limiting (will be handled by auth middleware)
      next();
      return;
    }

    const orgId = context.org?.id || context.orgId;
    if (!orgId) {
      next();
      return;
    }

    // Get rate limit settings
    let rps = 20; // default
    let burst = 40; // default

    const projectId = context.project?.id || context.projectId;
    if (projectId) {
      try {
        const projectSettings = await getProjectSettings(projectId);
        rps = projectSettings.rate_limit_rps;
        burst = projectSettings.rate_limit_burst;
      } catch (error) {
        // Fall back to defaults
      }
    }

    // Create bucket key
    const bucketKey = projectId
      ? `${orgId}:${projectId}:${context.apiKeyId || context.userId || "anon"}`
      : `${orgId}:${context.apiKeyId || context.userId || "anon"}`;

    // Get or create bucket
    const bucket = getBucket(bucketKey, burst, rps);

    // Check if request is allowed
    if (bucket.tokens < 1) {
      safeLog("warn", "Rate limit exceeded", {
        orgId,
        projectId,
        bucketKey,
        rps,
        burst,
      });

      res.status(429).json({
        error: "Rate limit exceeded",
        message: `Too many requests. Limit: ${rps} requests/second, burst: ${burst}`,
        retryAfter: Math.ceil(1 / rps), // seconds until next token
      });
      return;
    }

    // Consume token
    bucket.tokens -= 1;

    // Add rate limit headers
    res.setHeader("X-RateLimit-Limit", rps.toString());
    res.setHeader("X-RateLimit-Burst", burst.toString());
    res.setHeader("X-RateLimit-Remaining", Math.floor(bucket.tokens).toString());
    res.setHeader("X-RateLimit-Reset", new Date(bucket.lastRefill + 1000).toISOString());

    next();
  } catch (error: any) {
    // Rate limiting should not break requests
    safeLog("error", "Rate limit middleware error", { error: error.message });
    next(); // Allow request through on error
  }
}
