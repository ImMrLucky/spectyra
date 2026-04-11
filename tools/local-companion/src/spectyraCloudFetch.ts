/**
 * Outbound calls to Spectyra Cloud `/v1/*` from the companion CLI and server.
 *
 * Some public hostnames serve the marketing site and only forward certain requests to the API.
 * When the resolved API base returns **404** for a path, we retry once against the baked-in
 * Railway `/v1` URL from deployment docs. After that, we stick to Railway for the process
 * so polling (billing status, etc.) stays on one host.
 */

import { resolveSpectyraCloudApiV1Base, SPECTYRA_CLOUD_API_RAILWAY_V1 } from "./cloudDefaults.js";

let preferRailwayOnly = false;

/** For tests or after config reload (rare). */
export function resetSpectyraV1FetchPreference(): void {
  preferRailwayOnly = false;
}

/**
 * `segment` is the path under `/v1`, e.g. `billing/checkout` or `auth/ensure-account`.
 */
export async function fetchSpectyraV1(segment: string, init?: RequestInit): Promise<Response> {
  const railway = SPECTYRA_CLOUD_API_RAILWAY_V1.replace(/\/$/, "");
  const resolved = resolveSpectyraCloudApiV1Base().replace(/\/$/, "");
  const seg = segment.replace(/^\//, "");
  const urlRailway = `${railway}/${seg}`;

  if (preferRailwayOnly || resolved === railway) {
    return fetch(urlRailway, init);
  }

  const urlResolved = `${resolved}/${seg}`;
  let r = await fetch(urlResolved, init);
  if (r.status === 404 && resolved !== railway) {
    const r2 = await fetch(urlRailway, init);
    if (r2.status !== 404) {
      preferRailwayOnly = true;
    }
    return r2;
  }
  return r;
}
