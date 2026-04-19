/**
 * Production Spectyra Cloud endpoints baked into the published companion.
 * End users need no .env for account, billing, or analytics — optional overrides only.
 *
 * Optional env override: `SPECTYRA_API_URL` (used by companion when cloud calls are enabled).
 *
 * The **canonical** product API base is `https://spectyra.ai/v1`. Some deployments route that
 * hostname only to static or partial stacks; **POST** may not reach the API. Outbound calls use
 * `fetchSpectyraV1` in `spectyraCloudFetch.ts`, which retries on **404** against the Railway host
 * listed in `SPECTYRA_CLOUD_API_RAILWAY_V1` (same app as in LAUNCH docs / vercel destination).
 */
export const SPECTYRA_CLOUD_API_RAILWAY_V1 = "https://spectyra.up.railway.app/v1";

export const DEFAULT_SPECTYRA_CLOUD_API_V1 = "https://spectyra.ai/v1";
export const DEFAULT_SPECTYRA_WEB_ORIGIN = "https://spectyra.ai";

/**
 * True when the URL host is loopback. Any such SPECTYRA_API_URL is almost always a mistaken
 * dev default (or points at a local process that is not production); billing/checkout would fail or proxy to self.
 */
export function urlLooksLikeLoopbackHttpUrl(apiUrl: string): boolean {
  const t = apiUrl.trim();
  if (!t) return false;
  try {
    const u = new URL(t.includes("://") ? t : `http://${t}`);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1"
    );
  } catch {
    return false;
  }
}

/**
 * Ensures the base URL targets the `/v1` API prefix. A common misconfiguration is
 * `https://spectyra.ai` or `https://*.railway.app` without `/v1`, which yields HTTP 404 on `/billing/checkout`.
 */
export function normalizeSpectyraCloudApiV1Base(raw: string): string {
  const t = raw.replace(/\/$/, "");
  if (t.endsWith("/v1")) return t;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    const path = u.pathname.replace(/\/$/, "") || "";
    if (!path || path === "/") {
      return `${u.origin}/v1`;
    }
  } catch {
    /* fall through */
  }
  return `${t}/v1`;
}

/**
 * Resolves the Spectyra Cloud `/v1` base URL for server-side fetches (billing, analytics, CLI, etc.).
 *
 * Priority:
 * 1. `SPECTYRA_CLOUD_API_URL` — use when set (explicit production/staging API base).
 * 2. `SPECTYRA_API_URL` — use when set **unless** it is loopback; loopback falls back to the baked-in default
 *    (set `SPECTYRA_ALLOW_LOCAL_CLOUD_API=true` to allow a loopback URL for local API development).
 * 3. Baked-in `DEFAULT_SPECTYRA_CLOUD_API_V1`.
 *
 * Prefer `fetchSpectyraV1` from `spectyraCloudFetch.ts` for HTTP calls so 404 is retried against Railway.
 */
export function resolveSpectyraCloudApiV1Base(): string {
  const def = DEFAULT_SPECTYRA_CLOUD_API_V1.replace(/\/$/, "");
  const explicitCloud = process.env.SPECTYRA_CLOUD_API_URL?.trim();
  if (explicitCloud) {
    return normalizeSpectyraCloudApiV1Base(explicitCloud);
  }
  const raw = process.env.SPECTYRA_API_URL?.trim();
  if (!raw) return def;
  const allowLocal = process.env.SPECTYRA_ALLOW_LOCAL_CLOUD_API === "true";
  if (!allowLocal && urlLooksLikeLoopbackHttpUrl(raw)) {
    return def;
  }
  return normalizeSpectyraCloudApiV1Base(raw);
}
