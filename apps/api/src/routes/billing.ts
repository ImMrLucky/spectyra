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
  syncOrgSeatLimitToMemberFloor,
  updateOrgSubscription,
  updateOrgStripeCustomerId,
  clearOrgStripeCustomerId,
  type Org,
} from "../services/storage/orgsRepo.js";
import {
  requireSpectyraApiKey,
  optionalProviderKey,
  requireUserSession,
  billingAccessOpts,
  type AuthenticatedRequest,
} from "../middleware/auth.js";
import { hasActiveAccess } from "../services/storage/orgsRepo.js";
import { isSavingsObserveOnly } from "../billing/savingsEligibility.js";
import { safeLog } from "../utils/redaction.js";

export const billingRouter = Router();

function isStripeNoSuchCustomerError(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code === "resource_missing") return true;
  const m = typeof e?.message === "string" ? e.message : "";
  return /No such customer/i.test(m);
}

// Initialize Stripe (use type assertion for newer API version)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
});

/** Webhooks may send expandable Stripe fields as id string or nested object. */
function stripeCustomerId(
  customer:
    | Stripe.Subscription["customer"]
    | Stripe.Checkout.Session["customer"],
): string | null {
  if (customer == null) return null;
  if (typeof customer === "string") return customer;
  if (typeof customer === "object" && "id" in customer && typeof customer.id === "string") {
    return customer.id;
  }
  return null;
}

function stripeSubscriptionIdField(
  sub: Stripe.Checkout.Session["subscription"],
): string | null {
  if (sub == null) return null;
  if (typeof sub === "string") return sub;
  if (typeof sub === "object" && typeof sub.id === "string") return sub.id;
  return null;
}

function metadataSpectyraOrgId(
  meta: Stripe.Metadata | null | undefined,
): string | null {
  const raw = meta?.spectyra_org_id;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

async function resolveOrgForStripeSubscription(
  customerId: string | null,
  metadataOrgId: string | null,
): Promise<Org | null> {
  if (customerId) {
    const byCustomer = await getOrgByStripeCustomerId(customerId);
    if (byCustomer) return byCustomer;
  }
  if (metadataOrgId) {
    const trimmed = metadataOrgId.trim();
    if (/^[0-9a-f-]{36}$/i.test(trimmed)) {
      return getOrgById(trimmed);
    }
  }
  return null;
}

/** Apply Stripe subscription fields to a known org row (webhooks resolve org; self-service already has org id). */
export async function applySubscriptionPayloadToKnownOrg(
  orgId: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const isActive =
    subscription.status === "active" || subscription.status === "trialing";
  const qty = subscription.items?.data?.[0]?.quantity;
  const seatLimit =
    isActive &&
    typeof qty === "number" &&
    Number.isFinite(qty) &&
    qty >= 1
      ? qty
      : null;

  await updateOrgSubscription(
    orgId,
    subscription.id,
    subscription.status,
    isActive,
    {
      currentPeriodEndUnix: subscription.current_period_end ?? null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? null,
      seatLimit,
    },
  );
  if (
    subscription.status === "canceled" ||
    subscription.status === "unpaid" ||
    subscription.status === "incomplete_expired"
  ) {
    await syncOrgSeatLimitToMemberFloor(orgId);
  }
  safeLog("info", "Subscription updated", {
    org_id: orgId,
    status: subscription.status,
    active: isActive,
  });
}

/** Used by webhooks and self-service subscription routes to keep `orgs` in sync with Stripe. */
export async function applySubscriptionPayloadToOrg(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = stripeCustomerId(subscription.customer);
  const metadataOrgId = metadataSpectyraOrgId(subscription.metadata);
  const org = await resolveOrgForStripeSubscription(customerId, metadataOrgId);
  if (!org) {
    safeLog("warn", "Subscription webhook: no org for customer or metadata", {
      customer_id: customerId,
      spectyra_org_id: metadataOrgId,
      subscription_id: subscription.id,
    });
    return;
  }

  await applySubscriptionPayloadToKnownOrg(org.id, subscription);
}

/**
 * POST /v1/billing/checkout
 * 
 * Creates a Stripe checkout session for org subscription
 * Requires authentication (Supabase JWT or API key)
 */
billingRouter.post("/checkout", async (req: AuthenticatedRequest, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY?.trim()) {
      return res.status(503).json({
        error: "Billing is not configured",
        message: "STRIPE_SECRET_KEY is missing",
      });
    }
    if (!process.env.STRIPE_PRICE_ID?.trim()) {
      return res.status(503).json({
        error: "Billing is not configured",
        message: "STRIPE_PRICE_ID is missing",
      });
    }

    let orgId: string | null = null;

    // Try Supabase JWT first (same promise pattern as GET /status — async next() is not awaited by Express)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      let jwtAuthSucceeded = false;
      let middlewareCompleted = false;

      await new Promise<void>((resolve) => {
        const nextCallback = () => {
          jwtAuthSucceeded = true;
          middlewareCompleted = true;
          resolve();
        };

        requireUserSession(req, res, nextCallback)
          .then(() => {
            if (!middlewareCompleted) {
              middlewareCompleted = true;
              resolve();
            }
          })
          .catch(() => {
            middlewareCompleted = true;
            resolve();
          });
      });

      if (res.headersSent) {
        return;
      }

      if (jwtAuthSucceeded && req.auth?.userId) {
        const { queryOne } = await import("../services/storage/db.js");
        const membership = await queryOne<{ org_id: string }>(`
          SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
        `, [req.auth.userId]);

        if (!membership) {
          return res.status(404).json({ error: "Organization not found" });
        }

        orgId = membership.org_id;
      }
    }

    // Fall back to API key auth
    if (!orgId && !res.headersSent) {
      let apiKeyAuthSucceeded = false;
      let middlewareCompleted = false;

      await new Promise<void>((resolve) => {
        const nextCallback = () => {
          apiKeyAuthSucceeded = true;
          middlewareCompleted = true;
          resolve();
        };

        requireSpectyraApiKey(req, res, nextCallback)
          .then(() => {
            if (!middlewareCompleted) {
              middlewareCompleted = true;
              resolve();
            }
          })
          .catch(() => {
            middlewareCompleted = true;
            resolve();
          });
      });

      if (apiKeyAuthSucceeded && !res.headersSent && req.context) {
        orgId = req.context.org.id;
      }

      if (res.headersSent) {
        return;
      }
    }

    if (!orgId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const { success_url, cancel_url, checkout_quantity } = req.body as {
      success_url?: string;
      cancel_url?: string;
      /** When set, Stripe line-item qty (OpenClaw / companion typically sends 1). Capped at org seat_limit. */
      checkout_quantity?: unknown;
    };

    const org = await getOrgById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const seatCap = Math.max(1, org.seat_limit ?? 1);
    let quantity = seatCap;
    if (
      checkout_quantity !== undefined &&
      checkout_quantity !== null &&
      checkout_quantity !== ""
    ) {
      const n =
        typeof checkout_quantity === "number"
          ? checkout_quantity
          : parseInt(String(checkout_quantity), 10);
      if (!Number.isFinite(n) || n < 1) {
        return res.status(400).json({
          error: "checkout_quantity must be a positive integer",
        });
      }
      quantity = Math.min(seatCap, Math.floor(n));
    }
    
    const createStripeCustomer = async () => {
      const customer = await stripe.customers.create({
        email: req.auth?.email?.trim() || `${org.id}@spectyra.local`,
        name: org.name,
        metadata: {
          spectyra_org_id: org.id,
        },
      });
      await updateOrgStripeCustomerId(org.id, customer.id);
      return customer.id;
    };

    // Create or get Stripe customer
    let customerId = org.stripe_customer_id;
    if (!customerId) {
      customerId = await createStripeCustomer();
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID || "", // Set in env
          quantity,
        },
      ],
      subscription_data: {
        // App-side trial is stored on the org (DEFAULT_ORG_TRIAL_DAYS). Default 0 = no extra Stripe trial at checkout.
        // Set STRIPE_TRIAL_DAYS only if you want Stripe to add subscription trial days on top of app logic.
        ...((): { trial_period_days?: number } => {
          const rawStr = process.env.STRIPE_TRIAL_DAYS?.trim();
          const raw = parseInt(rawStr && rawStr.length > 0 ? rawStr : "0", 10);
          const days =
            Number.isFinite(raw) && raw > 0 ? Math.min(365, raw) : null;
          return days !== null ? { trial_period_days: days } : {};
        })(),
        metadata: {
          spectyra_org_id: org.id,
        },
      },
      success_url: success_url || `${req.headers.origin || "https://spectyra.ai"}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${req.headers.origin || "https://spectyra.ai"}/billing/cancel`,
      metadata: {
        spectyra_org_id: org.id,
      },
    };

    let session: Stripe.Response<Stripe.Checkout.Session>;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (firstErr: unknown) {
      // Common: org has a customer id from test mode but API now uses live keys (or vice versa).
      if (org.stripe_customer_id && isStripeNoSuchCustomerError(firstErr)) {
        safeLog("warn", "Checkout: stale Stripe customer id, recreating", { org_id: org.id });
        await clearOrgStripeCustomerId(org.id);
        customerId = await createStripeCustomer();
        session = await stripe.checkout.sessions.create({
          ...sessionParams,
          customer: customerId,
        });
      } else {
        throw firstErr;
      }
    }

    res.json({
      checkout_url: session.url,
      session_id: session.id,
    });
  } catch (error: any) {
    const msg = error?.message || "Internal server error";
    const code = error?.code;
    const type = error?.type;
    safeLog("error", "Checkout error", { error: msg, code, type });
    res.status(500).json({
      error: msg,
      stripe_code: typeof code === "string" ? code : undefined,
      stripe_type: typeof type === "string" ? type : undefined,
    });
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
        await applySubscriptionPayloadToOrg(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = stripeCustomerId(subscription.customer);
        const metadataOrgId = metadataSpectyraOrgId(subscription.metadata);
        const org = await resolveOrgForStripeSubscription(customerId, metadataOrgId);
        if (org) {
          await updateOrgSubscription(org.id, null, "canceled", false, {
            currentPeriodEndUnix: null,
            cancelAtPeriodEnd: false,
            seatLimit: null,
          });
          await syncOrgSeatLimitToMemberFloor(org.id);
          safeLog("info", "Subscription canceled", { org_id: org.id });
        } else {
          safeLog("warn", "subscription.deleted: no org matched", {
            customer_id: customerId,
            spectyra_org_id: metadataOrgId,
          });
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = stripeCustomerId(session.customer);

        if (session.mode === "subscription") {
          const subId = stripeSubscriptionIdField(session.subscription);
          if (subId) {
            try {
              const sub = await stripe.subscriptions.retrieve(subId);
              await applySubscriptionPayloadToOrg(sub);
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              safeLog("error", "checkout.session.completed: retrieve subscription failed", {
                error: msg,
                subscription_id: subId,
              });
            }
          } else {
            safeLog("warn", "checkout.session.completed: missing subscription id", {
              customer_id: customerId,
            });
          }
        } else {
          safeLog("info", "Checkout completed (non-subscription)", {
            customer_id: customerId,
            mode: session.mode,
          });
        }
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
 * Get current org billing status (requires auth - Supabase JWT or API key)
 */
billingRouter.get("/status", async (req: AuthenticatedRequest, res) => {
  try {
    let orgId: string | null = null;

    // Try Supabase JWT first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      let jwtAuthSucceeded = false;
      let middlewareCompleted = false;
      
      // Wrap requireUserSession in a promise to handle the middleware pattern
      await new Promise<void>((resolve) => {
        const nextCallback = () => {
          // This callback is executed when JWT verification succeeds (next() is called)
          jwtAuthSucceeded = true;
          middlewareCompleted = true;
          resolve();
        };
        
        requireUserSession(req, res, nextCallback)
          .then(() => {
            // Middleware Promise resolved - check if next() was called
            if (!middlewareCompleted) {
              // Middleware completed without calling next() - response was sent (error case)
              middlewareCompleted = true;
              resolve();
            }
          })
          .catch(() => {
            // Error in middleware - response already sent
            middlewareCompleted = true;
            resolve();
          });
      });
      
      // If JWT auth succeeded and no response was sent yet, get orgId
      if (jwtAuthSucceeded && !res.headersSent) {
        if (!req.auth?.userId) {
          return res.status(401).json({ error: "Not authenticated" });
        }

        const { queryOne } = await import("../services/storage/db.js");
        const membership = await queryOne<{ org_id: string }>(`
          SELECT org_id FROM org_memberships WHERE user_id = $1 LIMIT 1
        `, [req.auth.userId]);

        if (!membership) {
          return res.status(404).json({ error: "Organization not found" });
        }

        orgId = membership.org_id;
      }
      
      // If response was already sent (error case from middleware), return early
      if (res.headersSent) {
        return;
      }
    }

    // Fall back to API key auth (only if no response was sent)
    if (!orgId && !res.headersSent) {
      let apiKeyAuthSucceeded = false;
      let middlewareCompleted = false;
      
      await new Promise<void>((resolve) => {
        const nextCallback = () => {
          apiKeyAuthSucceeded = true;
          middlewareCompleted = true;
          resolve();
        };
        
        requireSpectyraApiKey(req, res, nextCallback)
          .then(() => {
            if (!middlewareCompleted) {
              middlewareCompleted = true;
              resolve();
            }
          })
          .catch(() => {
            middlewareCompleted = true;
            resolve();
          });
      });
      
      if (apiKeyAuthSucceeded && !res.headersSent && req.context) {
        orgId = req.context.org.id;
      }
      
      if (res.headersSent) {
        return;
      }
    }

    if (!orgId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const org = await getOrgById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    const hasAccess = hasActiveAccess(org, billingAccessOpts(req));
    const observeOnly = isSavingsObserveOnly(org, billingAccessOpts(req));
    const trialEnd = org.trial_ends_at ? new Date(org.trial_ends_at) : null;
    const isTrialActive = trialEnd ? trialEnd > new Date() : false;
    
    res.json({
      org: {
        id: org.id,
        name: org.name,
      },
      has_access: hasAccess,
      observe_only_savings: observeOnly,
      observe_only_override: org.observe_only_override,
      trial_ends_at: org.trial_ends_at,
      trial_active: isTrialActive,
      subscription_status: org.subscription_status,
      subscription_active: org.subscription_status === "active",
      cancel_at_period_end: !!org.cancel_at_period_end,
      platform_role: req.auth?.platformRole ?? null,
      platform_billing_exempt: !!req.auth?.platformRole,
      org_platform_exempt: !!org.platform_exempt,
      stripe_customer_id: org.stripe_customer_id,
    });
  } catch (error: any) {
    if (!res.headersSent) {
      safeLog("error", "Billing status error", { error: error.message });
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
});
