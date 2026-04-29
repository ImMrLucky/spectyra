import type { SpectyraMonitorEvent } from "../monitor/monitorTypes.js";

export interface FlushMonitorEventsToCloudOptions {
  /** e.g. `https://api.spectyra.com` — no trailing slash required */
  baseUrl: string;
  /** Machine key (`X-SPECTYRA-API-KEY`), not a provider key */
  apiKey: string;
  /** Optional project slug/id for multi-project orgs (same semantics as telemetry/run) */
  project?: string;
  events: SpectyraMonitorEvent[];
  fetchImpl?: typeof fetch;
}

/**
 * POST redacted monitor rows to Spectyra Cloud (`POST /v1/telemetry/monitor-events`).
 * Fail-open: returns `{ ok: false }` on network/shape errors without throwing.
 */
export async function flushMonitorEventsToCloud(
  opts: FlushMonitorEventsToCloudOptions,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const f = opts.fetchImpl ?? globalThis.fetch;
  if (!f) return { ok: false, error: "fetch_unavailable" };
  const base = opts.baseUrl.replace(/\/$/, "");
  const url = `${base}/v1/telemetry/monitor-events`;
  const body = JSON.stringify({
    project: opts.project,
    events: opts.events.slice(0, 200),
  });
  try {
    const res = await f(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SPECTYRA-API-KEY": opts.apiKey,
      },
      body,
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: t.slice(0, 200) || res.statusText };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
