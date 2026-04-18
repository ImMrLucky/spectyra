/**
 * Shared option objects for `rateLimit()` from `express-rate-limit`.
 * Route modules should call `rateLimit(<preset>)` so both CodeQL and humans see limiting at the router.
 */

/** Typical authenticated / API-key routes */
export const RL_STANDARD = {
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests; try again shortly." },
} as const;

/** Liveness/readiness — avoid tripping load balancer probes */
export const RL_HEALTH = {
  windowMs: 60_000,
  max: 2500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests; try again shortly." },
} as const;

/** Stripe checkout + webhook bursts */
export const RL_BILLING = {
  windowMs: 60_000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many billing requests; try again shortly." },
} as const;

/** Unauthenticated telemetry */
export const RL_ANONYMOUS = {
  windowMs: 60_000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests; try again shortly." },
} as const;

/** JWT account routes (GET summary + mutations share a bucket) */
export const RL_ACCOUNT = {
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many account requests; try again shortly." },
} as const;

/** Self-service account deletion */
export const RL_ACCOUNT_DELETE = {
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many account deletion requests; try again shortly." },
} as const;

/** Owner admin panel — general cap */
export const RL_ADMIN = {
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin requests; try again shortly." },
} as const;

export const RL_ADMIN_USER_PATCH = {
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many admin user update requests; try again shortly." },
} as const;

export const RL_ADMIN_USER_DELETE = {
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many user delete requests; try again shortly." },
} as const;

/** POST bootstrap, ensure-account, sync-billing-exempt */
export const RL_AUTH_ACCOUNT_MUTATION = {
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many account requests; try again shortly." },
} as const;

export const RL_AUTH_AUTO_CONFIRM = {
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auto-confirm requests; try again shortly." },
} as const;
