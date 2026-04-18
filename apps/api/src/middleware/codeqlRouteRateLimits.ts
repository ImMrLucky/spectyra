/**
 * Options objects for `rateLimit()` from `express-rate-limit`.
 *
 * Each route module should do `import rateLimit from "express-rate-limit"` and pass
 * `rateLimit(…Options)` next to the route handler so CodeQL can tie limiting to the route.
 */

const json429 = (msg: string) => ({ error: msg });

/** @see https://express-rate-limit.mintlify.app/reference/configuration */
export const adminListUsersRateLimitOptions = {
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many admin user list requests; try again shortly."),
} as const;

export const adminPatchUserRateLimitOptions = {
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many admin user update requests; try again shortly."),
} as const;

export const adminDeleteUserRateLimitOptions = {
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many user delete requests; try again shortly."),
} as const;

export const inferenceRouteRateLimitOptions = {
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many inference requests; try again shortly."),
} as const;

export const authAccountMutationRateLimitOptions = {
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many account requests; try again shortly."),
} as const;

export const authAutoConfirmRateLimitOptions = {
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many auto-confirm requests; try again shortly."),
} as const;

export const superuserMutationRateLimitOptions = {
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many superuser requests; try again shortly."),
} as const;

export const superuserReadRateLimitOptions = {
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many superuser requests; try again shortly."),
} as const;

/** JWT account summary + self-service Stripe / Supabase work. */
export const accountReadRateLimitOptions = {
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many account requests; try again shortly."),
} as const;

export const accountMutationRateLimitOptions = {
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many account requests; try again shortly."),
} as const;

export const accountDeleteRateLimitOptions = {
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: json429("Too many account deletion requests; try again shortly."),
} as const;
