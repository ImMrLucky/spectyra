import type { EntitlementsStatusPayload } from "./mapEntitlementStatus.js";

/**
 * Fetches `GET {base}/entitlements/status` with `X-SPECTYRA-API-KEY`.
 * `base` must include `/v1`, e.g. `https://api.spectyra.com/v1`.
 */
export async function fetchEntitlementStatus(
  baseUrl: string,
  apiKey: string,
): Promise<EntitlementsStatusPayload> {
  const u = `${baseUrl.replace(/\/$/, "")}/entitlements/status`;
  const res = await fetch(u, { headers: { "X-SPECTYRA-API-KEY": apiKey } });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Spectyra entitlements: HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  return (await res.json()) as EntitlementsStatusPayload;
}
