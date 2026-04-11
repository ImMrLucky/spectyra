/**
 * Production Spectyra Cloud endpoints baked into the published companion.
 * End users need no .env for account, billing, or analytics — optional overrides only.
 *
 * Keep in sync: packages/openclaw-skill/setup.sh (SPECTYRA_API default).
 * Public hostname matches https://spectyra.ai; Vercel rewrites /v1 to Railway (see vercel.json).
 */
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
  if (explicitCloud) {
    return explicitCloud.replace(/\/$/, "");
  }
  const raw = process.env.SPECTYRA_API_URL?.trim();
  if (!raw) return def;
  const allowLocal = process.env.SPECTYRA_ALLOW_LOCAL_CLOUD_API === "true";
  if (!allowLocal && urlLooksLikeLoopbackHttpUrl(raw)) {
    return def;
  }
  return raw.replace(/\/$/, "");
}
