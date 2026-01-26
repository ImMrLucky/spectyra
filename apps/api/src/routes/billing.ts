/**
 * Billing Routes
 * 
 * Handles Stripe checkout and webhooks for org-based subscriptions
 */

import { Router } from "express";
import Stripe from "stripe";
import {
  getOrgById,
  getOrgByStripeCustomerId,
  updateOrgSubscription,
  updateOrgStripeCustomerId,
} from "../services/storage/orgsRepo.js";
import { requireSpectyraApiKey, optionalProviderKey, type AuthenticatedRequest } from "../middleware/auth.js";
import { hasActiveAccess } from "../services/storage/orgsRepo.js";
import { safeLog } from "../utils/redaction.js";

export const billingRouter = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

/**
 * POST /v1/billing/checkout
 * 
 * Creates a Stripe checkout session for org subscription
 * Requires authentication (org context)
 */
billingRouter.post("/checkout", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { success_url, cancel_url } = req.body as {
      success_url?: string;
      cancel_url?: string;
    };
    
    const org = getOrgById(req.context.org.id);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    // Create or get Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: `${org.id}@spectyra.local`, // Placeholder, can be updated
        name: org.name,
        metadata: {
          spectyra_org_id: org.id,
        },
      });
      customerId = customer.id;
      updateOrgStripeCustomerId(org.id, customerId);
    }
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID || "", // Set in env
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          spectyra_org_id: org.id,
        },
      },
      success_url: success_url || `${req.headers.origin || "https://spectyra.com"}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.headers.origin || "https://spectyra.com"}/billing/cancel`,
      metadata: {
        spectyra_org_id: org.id,
      },
    });
    
    res.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error: any) {
    safeLog("error", "Checkout error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/billing/webhook
 * 
 * Handles Stripe webhooks for subscription events
 * Note: This route must use express.raw() middleware (configured in index.ts)
 */
billingRouter.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  
  if (!webhookSecret) {
    safeLog("error", "STRIPE_WEBHOOK_SECRET not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }
  
  // req.body is a Buffer for webhook route (due to express.raw())
  const body = req.body as Buffer;
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    safeLog("error", "Webhook signature verification failed", { error: err.message });
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
  
  try {
    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const org = getOrgByStripeCustomerId(customerId);
        if (org) {
          const isActive = subscription.status === "active" || subscription.status === "trialing";
          updateOrgSubscription(
            org.id,
            subscription.id,
            subscription.status,
            isActive
          );
          safeLog("info", "Subscription updated", {
            org_id: org.id,
            status: subscription.status,
            active: isActive,
          });
        }
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const org = getOrgByStripeCustomerId(customerId);
        if (org) {
          updateOrgSubscription(org.id, null, "canceled", false);
          safeLog("info", "Subscription canceled", { org_id: org.id });
        }
        break;
      }
      
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        
        // Subscription will be created via subscription.created event
        safeLog("info", "Checkout completed", { customer_id: customerId });
        break;
      }
      
      default:
        safeLog("info", "Unhandled webhook event", { type: event.type });
    }
    
    res.json({ received: true });
  } catch (error: any) {
    safeLog("error", "Webhook handler error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/billing/status
 * 
 * Get current org billing status (requires auth)
 */
billingRouter.get("/status", requireSpectyraApiKey, optionalProviderKey, async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.context) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const org = getOrgById(req.context.org.id);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const hasAccess = hasActiveAccess(org);
    const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const isTrialActive = trialEnd ? trialEnd > new Date() : false;
    
    res.json({
      org: {
        id: org.id,
        name: org.name,
      },
      has_access: hasAccess,
      trial_ends_at: org.trial_ends_at,
      trial_active: isTrialActive,
      subscription_status: org.subscription_status,
      subscription_active: org.subscription_status === "active",
    });
  } catch (error: any) {
    safeLog("error", "Billing status error", { error: error.message });
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});
