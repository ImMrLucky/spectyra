/**
 * Trial Gating Middleware
 * 
 * Enforces trial/subscription requirements for live provider calls.
 * Allows estimator mode and scenarios browsing even if trial expired.
 */

import { Response, NextFunction } from "express";
import { hasActiveAccess } from "../services/storage/orgsRepo.js";
import type { AuthenticatedRequest } from "./auth.js";

/**
 * Require active access (trial or subscription) for live provider calls
 * Blocks /v1/chat if trial expired and no subscription
 */
export function requireActiveAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.context) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  
  const org = req.context.org;
  if (!org) {
    res.status(401).json({ error: "Organization not found" });
    return;
  }
  
  // Check if org has active access
  if (!hasActiveAccess(org)) {
    const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const trialEnded = trialEnd ? trialEnd < new Date() : false;
    
    res.status(402).json({
      error: "Payment Required",
      message: "Your trial has expired. Please subscribe to continue using Spectyra.",
      trial_ended: trialEnded,
      subscription_active: org.subscription_status === "active",
      billing_url: "/billing",
    });
    return;
  }
  
  next();
}

/**
 * Allow estimator/demo mode even if trial expired
 * Used for /v1/replay with proof_mode=estimator
 */
export function allowEstimatorMode(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // Estimator mode is always allowed (no real LLM calls)
  next();
}
