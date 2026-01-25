/**
 * Billing Routes
 * 
 * Handles Stripe checkout and webhooks
 */

import { Router } from "express";
import Stripe from "stripe";
import { config } from "../config.js";
import {
  getUserByEmail,
  createUser,
  getUserByStripeCustomerId,
  updateUserSubscription,
  updateStripeCustomerId,
  createApiKey,
} from "../services/billing/usersRepo.js";
import { authenticate, type AuthenticatedRequest } from "../middleware/auth.js";
import { hasActiveAccess } from "../services/billing/usersRepo.js";

export const billingRouter = Router();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia",
});

/**
 * POST /v1/billing/checkout
 * 
 * Creates a Stripe checkout session with 7-day trial
 */
billingRouter.post("/checkout", async (req, res) => {
  try {
    const { email, success_url, cancel_url } = req.body as {
      email: string;
      success_url?: string;
      cancel_url?: string;
    };
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    // Get or create user
    let user = getUserByEmail(email);
    if (!user) {
      user = createUser(email, 7); // 7-day trial
    }
    
    // Create or get Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          spectyra_user_id: user.id,
        },
      });
      customerId = customer.id;
      updateStripeCustomerId(user.id, customerId);
    }
    
    // Create checkout session with trial
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
        trial_period_days: 7, // 7-day trial
        metadata: {
          spectyra_user_id: user.id,
        },
      },
      success_url: success_url || `${req.headers.origin || "https://spectyra.com"}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.headers.origin || "https://spectyra.com"}/billing/cancel`,
      metadata: {
        spectyra_user_id: user.id,
      },
    });
    
    res.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error: any) {
    console.error("Checkout error:", error);
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
    console.error("STRIPE_WEBHOOK_SECRET not set");
    return res.status(500).json({ error: "Webhook secret not configured" });
  }
  
  // req.body is a Buffer for webhook route (due to express.raw())
  const body = req.body as Buffer;
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }
  
  try {
    // Handle the event
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const user = getUserByStripeCustomerId(customerId);
        if (user) {
          const isActive = subscription.status === "active" || subscription.status === "trialing";
          updateUserSubscription(
            user.id,
            subscription.id,
            subscription.status,
            isActive
          );
        }
        break;
      }
      
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        
        const user = getUserByStripeCustomerId(customerId);
        if (user) {
          updateUserSubscription(user.id, null, "canceled", false);
        }
        break;
      }
      
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        
        // User has completed checkout, subscription will be created via subscription.created event
        // But we can ensure they have an API key
        const user = getUserByStripeCustomerId(customerId);
        if (user) {
          // Check if user has any API keys, create one if not
          // (This would require a helper function, but for now we'll let them create via another endpoint)
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
  } catch (error: any) {
    console.error("Webhook handler error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/billing/status
 * 
 * Get current subscription status (requires auth)
 */
billingRouter.get("/status", authenticate, async (req: AuthenticatedRequest, res) => {
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
      has_access: hasAccess,
      trial_ends_at: user.trial_ends_at,
      trial_active: isTrialActive,
      subscription_active: user.subscription_active,
      subscription_status: user.subscription_status,
    });
  } catch (error: any) {
    console.error("Billing status error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * POST /v1/billing/api-keys
 * 
 * Create a new API key (requires auth)
 */
billingRouter.post("/api-keys", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { name } = req.body as { name?: string };
    const { createApiKey } = await import("../services/billing/usersRepo.js");
    
    const { key, apiKey } = createApiKey(req.userId!, name || null);
    
    // Return the key only once (it's hashed in DB)
    res.json({
      id: apiKey.id,
      key, // Only returned on creation
      name: apiKey.name,
      created_at: apiKey.created_at,
    });
  } catch (error: any) {
    console.error("Create API key error:", error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * GET /v1/billing/api-keys
 * 
 * List API keys (requires auth)
 */
billingRouter.get("/api-keys", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { getUserApiKeys } = await import("../services/billing/usersRepo.js");
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
 * DELETE /v1/billing/api-keys/:id
 * 
 * Delete an API key (requires auth)
 */
billingRouter.delete("/api-keys/:id", authenticate, async (req: AuthenticatedRequest, res) => {
  try {
    const { deleteApiKey } = await import("../services/billing/usersRepo.js");
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
