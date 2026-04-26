import type { EntitlementsStatusPayload } from "./mapEntitlementStatus.js";

/** Thrown when `GET …/entitlements/status` returns a non-2xx status (SDK maps 401/403 to quota states). */
export class EntitlementHttpError extends Error {
  readonly status: number;
  readonly bodySnippet: string;

  constructor(status: number, bodySnippet: string) {
    super(`Spectyra entitlements: HTTP ${status} ${bodySnippet.slice(0, 200)}`);
    this.name = "EntitlementHttpError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

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
    throw new EntitlementHttpError(res.status, t);
  }
  return (await res.json()) as EntitlementsStatusPayload;
}
