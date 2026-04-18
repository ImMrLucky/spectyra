/**
 * express-rate-limit presets for CodeQL "missing rate limiting" on expensive routes.
 * Applied after auth middleware so limits are per IP (configure trust proxy when behind a load balancer).
 */

import rateLimit from "express-rate-limit";

const json429 = (msg: string) => ({ error: msg });

export const adminListUsersLimiter = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many admin user list requests; try again shortly."),
});

export const adminPatchUserLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many admin user update requests; try again shortly."),
});

export const adminDeleteUserLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many user delete requests; try again shortly."),
});

/** LLM / replay / studio inference (provider calls). */
export const inferenceRouteLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many inference requests; try again shortly."),
});

/** Authenticated account provisioning / sync. */
export const authAccountMutationLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many account requests; try again shortly."),
});

/** Supabase admin auto-confirm — stricter. */
export const authAutoConfirmLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many auto-confirm requests; try again shortly."),
});

/** Superuser console mutations. */
export const superuserMutationLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many superuser requests; try again shortly."),
});
