import type { ProviderPricingSnapshot } from "./types.js";

/**
 * Fetch `GET {base}/pricing/snapshot` with machine API key.
 */
export async function fetchPricingSnapshot(
  baseUrl: string,
  apiKey: string,
  provider?: string,
): Promise<ProviderPricingSnapshot> {
  const base = baseUrl.replace(/\/$/, "");
  const q = provider ? `?provider=${encodeURIComponent(provider)}` : "";
  const url = `${base}/pricing/snapshot${q}`;
  const res = await fetch(url, {
    headers: { "X-SPECTYRA-API-KEY": apiKey },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Spectyra pricing: HTTP ${res.status} ${t.slice(0, 200)}`);
  }
  return (await res.json()) as ProviderPricingSnapshot;
}
