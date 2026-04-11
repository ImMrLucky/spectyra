/**
 * Production Spectyra Cloud endpoints baked into the published companion.
 * End users need no .env for account, billing, or analytics — optional overrides only.
 *
 * Keep in sync: packages/openclaw-skill/setup.sh (SPECTYRA_API default).
 *
 * **Important:** `https://spectyra.ai/v1` is proxied from Vercel for GET, but POST to that host
 * currently returns HTTP 404 (requests do not reach the API). The live API is on Railway; see
 * vercel.json `destination`. Use the Railway `/v1` base for all server-side and CLI POST traffic.
 */
export const SPECTYRA_CLOUD_API_RAILWAY_V1 = "https://spectyra.up.railway.app/v1";

export const DEFAULT_SPECTYRA_CLOUD_API_V1 = SPECTYRA_CLOUD_API_RAILWAY_V1;
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
 * If env still points at `spectyra.ai/v1`, remap to Railway — POST to spectyra.ai/v1/* returns 404.
 */
function rewriteSpectyraAiV1BaseToRailway(v1Base: string): string {
  const t = v1Base.trim().replace(/\/$/, "");
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    const path = u.pathname.replace(/\/$/, "") || "";
    const host = u.hostname.toLowerCase();
    if ((host === "spectyra.ai" || host === "www.spectyra.ai") && path === "/v1") {
      return SPECTYRA_CLOUD_API_RAILWAY_V1.replace(/\/$/, "");
    }
  } catch {
    /* keep t */
  }
  return t;
}

/**
 * Resolves the Spectyra Cloud `/v1` base URL for server-side fetches (billing, analytics, CLI, etc.).
 *
 * Priority:
 * 1. `SPECTYRA_CLOUD_API_URL` — use when set (explicit production/staging API base).
 * 2. `SPECTYRA_API_URL` — use when set **unless** it is loopback; loopback falls back to the baked-in default
 *    (set `SPECTYRA_ALLOW_LOCAL_CLOUD_API=true` to allow a loopback URL for local API development).
 * 3. Baked-in `DEFAULT_SPECTYRA_CLOUD_API_V1`.
 */
export function resolveSpectyraCloudApiV1Base(): string {
  const def = DEFAULT_SPECTYRA_CLOUD_API_V1.replace(/\/$/, "");
  const explicitCloud = process.env.SPECTYRA_CLOUD_API_URL?.trim();
  let resolved: string;
  if (explicitCloud) {
    resolved = normalizeSpectyraCloudApiV1Base(explicitCloud);
  } else {
    const raw = process.env.SPECTYRA_API_URL?.trim();
    if (!raw) {
      resolved = def;
    } else {
      const allowLocal = process.env.SPECTYRA_ALLOW_LOCAL_CLOUD_API === "true";
      if (!allowLocal && urlLooksLikeLoopbackHttpUrl(raw)) {
        resolved = def;
      } else {
        resolved = normalizeSpectyraCloudApiV1Base(raw);
      }
    }
  }
  return rewriteSpectyraAiV1BaseToRailway(resolved);
}
