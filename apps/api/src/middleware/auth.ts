/**
 * Authentication Middleware
 * 
 * Validates X-SPECTYRA-KEY header and checks trial/subscription status.
 * Returns 402 Payment Required if trial expired and no active subscription.
 */

import { Request, Response, NextFunction } from "express";
import { getApiKeyByHash, hashApiKey, updateApiKeyLastUsed } from "../services/billing/usersRepo.js";
import { getUserById, hasActiveAccess } from "../services/billing/usersRepo.js";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  apiKeyId?: string;
}

/**
 * Authentication middleware
 * Validates X-SPECTYRA-KEY and checks access (trial/subscription)
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const apiKey = req.headers["x-spectyra-key"] as string | undefined;
    
    if (!apiKey) {
      res.status(401).json({ error: "Missing X-SPECTYRA-KEY header" });
      return;
    }
    
    // Hash the key and look it up
    const keyHash = hashApiKey(apiKey);
    const apiKeyRecord = getApiKeyByHash(keyHash);
    
    if (!apiKeyRecord) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }
    
    // Get user
    const user = getUserById(apiKeyRecord.user_id);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    
    // Check access (trial or subscription)
    if (!hasActiveAccess(user)) {
      res.status(402).json({
        error: "Payment Required",
        message: "Your trial has expired. Please subscribe to continue using Spectyra.",
        trial_ended: user.trial_ends_at ? new Date(user.trial_ends_at) < new Date() : false,
        subscription_active: user.subscription_active,
      });
      return;
    }
    
    // Update last used timestamp (async, don't block)
    // Wrap in try-catch since updateApiKeyLastUsed is synchronous
    try {
      updateApiKeyLastUsed(keyHash);
    } catch (error) {
      // Ignore errors - don't block request if update fails
      console.warn("Failed to update API key last used:", error);
    }
    
    // Attach user info to request
    req.userId = user.id;
    req.apiKeyId = apiKeyRecord.id;
    
    next();
  } catch (error: any) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Optional authentication (doesn't fail if no key)
 * Used for endpoints that work with or without auth
 */
export async function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers["x-spectyra-key"] as string | undefined;
  
  if (apiKey) {
    // Try to authenticate, but don't fail if it doesn't work
    try {
      const keyHash = hashApiKey(apiKey);
      const apiKeyRecord = getApiKeyByHash(keyHash);
      
      if (apiKeyRecord) {
        const user = getUserById(apiKeyRecord.user_id);
        if (user && hasActiveAccess(user)) {
          req.userId = user.id;
          req.apiKeyId = apiKeyRecord.id;
        }
      }
    } catch (error) {
      // Ignore errors for optional auth
    }
  }
  
  next();
}
