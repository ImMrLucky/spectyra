# Stripe testing (before production / ClawHub)

Use **Stripe test mode** end-to-end before switching live keys.

## 1. Keys and dashboard

- In [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys), use **Test mode** secret and publishable keys in your API and web env (e.g. `STRIPE_SECRET_KEY`, client-side publishable key for Checkout).
- Confirm webhook endpoint URL points at your **staging** or local tunnel, registered with the **test** signing secret (`STRIPE_WEBHOOK_SECRET`).

## 2. Webhooks locally

- Run [Stripe CLI](https://stripe.com/docs/stripe-cli): `stripe listen --forward-to localhost:<api-port>/v1/billing/webhook` (adjust path to your app’s webhook route).
- Use the CLI-printed **webhook signing secret** in env while testing locally.

## 3. Cards and payments

- Successful charge: `4242 4242 4242 4242`, any future expiry, any CVC.
- Decline / authentication flows: see [Stripe test cards](https://stripe.com/docs/testing#cards).

## 4. Trials and “after trial” behavior

- **Test clocks** (Dashboard → Billing → Test clocks): attach a clock to a **test** customer, advance time past `trial_end` and confirm:
  - subscription status transitions as expected in your DB (`subscription_status`, `stripe_subscription_id`, etc.);
  - webhooks you handle (`customer.subscription.updated`, `invoice.paid`, `invoice.payment_failed`, etc.) run and your API updates org rows correctly.
- Alternatively create a subscription with a **short trial** in test mode and wait, or use Checkout with trial period set to minutes in test (where supported).

## 5. What to verify in your app

- After trial: user still has access per your rules (`has_access`, trial gate, entitlements).
- Failed renewal: user moves to expected state (e.g. past_due / locked) and UI matches API.
- Idempotency: replay the same webhook event and confirm no double application of state.

## 6. Before production

- Swap to **live** keys only after test-mode checklist passes.
- Register **production** webhook URL and live signing secret in Railway/hosting env.
- Optionally run one **small real** transaction in live mode with a real card you control, then refund in Dashboard.
