/**
 * Authentication Routes
 * 
 * User registration and API key management (without Stripe for now)
 */

import { Router } from "express";
import {
  createUser,
  getUserByEmail,
  createApiKey,
  getUserApiKeys,
  deleteApiKey,
  getUserById,
  hasActiveAccess,
} from "../services/billing/usersRepo.js";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.js";

export const authRouter = Router();

/**
 * POST /v1/auth/register
 * 
 * Register a new user and create their first API key
 */
authRouter.post("/register", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    
    if (!email || !email.includes("@")) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    
    // Check if user already exists
    const existing = getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "User with this email already exists" });
    }
    
    // Create user with 7-day trial
    const user = createUser(email, 7);
    
    // Create first API key
    const { key, apiKey } = createApiKey(user.id, "Default Key");
    
    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        trial_ends_at: user.trial_ends_at,
      },
      api_key: key, // Only returned once
      api_key_id: apiKey.id,
      message: "Account created successfully. Save your API key - it won't be shown again!",
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/auth/login
 * 
 * Validate API key and return user info
 * (With API keys, "login" is just validating the key)
 */
authRouter.post("/login", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { getUserById } = await import("../services/billing/usersRepo.js");
    const user = getUserById(req.userId!);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const hasAccess = hasActiveAccess(user);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        trial_ends_at: user.trial_ends_at,
        subscription_active: user.subscription_active,
      },
      has_access: hasAccess,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/auth/me
 * 
 * Get current user info (requires auth)
 */
authRouter.get("/me", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { getUserById } = await import("../services/billing/usersRepo.js");
    const user = getUserById(req.userId!);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const hasAccess = hasActiveAccess(user);
    const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
    const isTrialActive = trialEnd ? trialEnd > new Date() : false;
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        trial_ends_at: user.trial_ends_at,
        subscription_active: user.subscription_active,
      },
      has_access: hasAccess,
      trial_active: isTrialActive,
    });
  } catch (error: any) {
    console.error("Get user error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/auth/api-keys
 * 
 * Create a new API key (requires auth)
 */
authRouter.post("/api-keys", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body as { name?: string };
    const { key, apiKey } = createApiKey(req.userId!, name || null);
    
    res.json({
      id: apiKey.id,
      key, // Only returned once
      name: apiKey.name,
      created_at: apiKey.created_at,
    });
  } catch (error: any) {
    console.error("Create API key error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/auth/api-keys
 * 
 * List API keys (requires auth)
 */
authRouter.get("/api-keys", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const keys = getUserApiKeys(req.userId!);
    
    // Don't return key hashes, just metadata
    res.json(keys.map(k => ({
      id: k.id,
      name: k.name,
      created_at: k.created_at,
      last_used_at: k.last_used_at,
    })));
  } catch (error: any) {
    console.error("List API keys error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * DELETE /v1/auth/api-keys/:id
 * 
 * Delete an API key (requires auth)
 */
authRouter.delete("/api-keys/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const deleted = deleteApiKey(req.params.id, req.userId!);
    
    if (!deleted) {
      return res.status(404).json({ error: "API key not found" });
    }
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete API key error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
