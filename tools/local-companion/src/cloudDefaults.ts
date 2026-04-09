/**
 * Production Spectyra Cloud endpoints baked into the published companion.
 * End users need no .env for account, billing, or analytics — optional overrides only.
 *
 * Keep in sync: packages/openclaw-skill/setup.sh (SPECTYRA_API default).
 */
export const DEFAULT_SPECTYRA_CLOUD_API_V1 = "https://spectyra.up.railway.app/v1";
export const DEFAULT_SPECTYRA_WEB_ORIGIN = "https://spectyra.ai";

/**
 * True when SPECTYRA_API_URL points at this machine on the same port as the companion
 * (e.g. http://127.0.0.1:4111/v1). That misconfiguration makes billing proxy to itself; use hosted API instead.
 */
export function urlLooksLikeLocalCompanion(apiUrl: string, companionListenPort: number): boolean {
  const t = apiUrl.trim();
  if (!t) return false;
  try {
    const u = new URL(t.includes("://") ? t : `http://${t}`);
    const host = u.hostname.replace(/^\[|\]$/g, "");
    const loopback =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1";
    if (!loopback) return false;
    const p = u.port ? parseInt(u.port, 10) : u.protocol === "https:" ? 443 : 80;
    return p === companionListenPort;
  } catch {
    return false;
  }
}

/**
 * Resolves the Spectyra Cloud `/v1` base URL for server-side fetches (billing, analytics, etc.).
 * Honors SPECTYRA_API_URL unless it targets the local companion (loopback + same port), in which case
 * the baked-in Railway URL is used.
 */
export function resolveSpectyraCloudApiV1Base(companionListenPort: number): string {
  const def = DEFAULT_SPECTYRA_CLOUD_API_V1.replace(/\/$/, "");
  const raw = process.env.SPECTYRA_API_URL?.trim();
  if (!raw) return def;
  if (urlLooksLikeLocalCompanion(raw, companionListenPort)) {
    return def;
  }
  return raw.replace(/\/$/, "");
}
