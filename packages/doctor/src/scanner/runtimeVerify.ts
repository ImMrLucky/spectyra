import type { AiProviderId, AiUsageFinding } from "./types.js";

export interface RuntimeVerifyResult {
  baseUrl: string;
  reachable: boolean;
  summaryOk: boolean;
  eventsOk: boolean;
  wasteOk: boolean;
  requestCount?: number;
  eventsObserved?: number;
  providersObserved: string[];
  /** Providers seen in static scan but not in recent runtime events (heuristic). */
  possiblyMissed: Array<{ provider: AiProviderId | string; files: string[]; reason: string }>;
  errors: string[];
}

export function normalizeRuntimeBridgeUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (!/\/__spectyra(\/|$)/.test(u)) {
    u = `${u}/__spectyra`;
  }
  return u.replace(/\/+$/, "");
}

async function fetchJson(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; body: unknown }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      const text = await res.text();
      try {
        return { ok: res.ok, status: res.status, body: JSON.parse(text) as unknown };
      } catch {
        return { ok: false, status: res.status, body: { raw: text.slice(0, 200) } };
      }
    }
    return { ok: res.ok, status: res.status, body: (await res.json()) as unknown };
  } catch (e) {
    return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
  } finally {
    clearTimeout(t);
  }
}

function normMonitorProvider(p: string): string {
  if (p === "google-gemini") return "gemini";
  return p;
}

function staticProvidersByFiles(findings: AiUsageFinding[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  const skip = new Set(["unknown", "custom-gateway", "openai-compatible"]);
  for (const f of findings) {
    const p = f.provider;
    if (skip.has(p)) continue;
    const key = normMonitorProvider(p);
    if (!m.has(key)) m.set(key, new Set());
    m.get(key)!.add(f.relativePath);
  }
  return m;
}

function providersFromEvents(events: unknown): string[] {
  if (!Array.isArray(events)) return [];
  const out = new Set<string>();
  for (const ev of events) {
    if (ev && typeof ev === "object" && "provider" in ev) {
      const p = String((ev as { provider?: string }).provider ?? "");
      if (p) out.add(normMonitorProvider(p));
    }
  }
  return [...out];
}

export async function runRuntimeVerify(findings: AiUsageFinding[], runtimeUrl: string): Promise<RuntimeVerifyResult> {
  const baseUrl = normalizeRuntimeBridgeUrl(runtimeUrl);
  const errors: string[] = [];
  const result: RuntimeVerifyResult = {
    baseUrl,
    reachable: false,
    summaryOk: false,
    eventsOk: false,
    wasteOk: false,
    providersObserved: [],
    possiblyMissed: [],
    errors,
  };

  const timeout = 8000;
  const summaryPrimary = await fetchJson(`${baseUrl}/summary`, timeout);
  const summaryLegacy =
    summaryPrimary.status === 404 ? await fetchJson(`${baseUrl}/monitor/summary`, timeout) : { ok: false, status: 404, body: null };

  const summary = summaryPrimary.ok ? summaryPrimary : summaryLegacy.ok ? summaryLegacy : summaryPrimary;
  if (summary.ok && summary.body && typeof summary.body === "object") {
    result.summaryOk = true;
    result.reachable = true;
    const rc = (summary.body as { requestCount?: number }).requestCount;
    if (typeof rc === "number") result.requestCount = rc;
  } else if (summary.status === 401 || summary.status === 403) {
    errors.push(`Bridge returned ${summary.status} (token or host allowlist may be required).`);
  } else if (summary.status !== 0) {
    errors.push(`Summary: HTTP ${summary.status} — is the dev bridge mounted at ${baseUrl}?`);
  }

  const eventsPrimary = await fetchJson(`${baseUrl}/events?limit=120`, timeout);
  const eventsLegacy =
    eventsPrimary.status === 404 ? await fetchJson(`${baseUrl}/monitor/events?limit=120`, timeout) : { ok: false, status: 404, body: null };

  const events = eventsPrimary.ok ? eventsPrimary : eventsLegacy.ok ? eventsLegacy : eventsPrimary;
  if (events.ok && Array.isArray(events.body)) {
    result.eventsOk = true;
    result.reachable = true;
    result.eventsObserved = events.body.length;
    result.providersObserved = providersFromEvents(events.body);
  } else if (events.status && events.status !== 404) {
    errors.push(`Events: HTTP ${events.status}`);
  }

  const waste = await fetchJson(`${baseUrl}/waste`, timeout);
  if (waste.ok) {
    result.wasteOk = true;
    result.reachable = true;
  }

  const staticMap = staticProvidersByFiles(findings);
  const obs = new Set(result.providersObserved.map((p) => p.toLowerCase()));
  for (const [prov, files] of staticMap) {
    if (
      result.reachable &&
      result.eventsOk &&
      result.eventsObserved &&
      result.eventsObserved > 0 &&
      !obs.has(prov.toLowerCase())
    ) {
      result.possiblyMissed.push({
        provider: prov,
        files: [...files].slice(0, 12),
        reason:
          "Static scan saw this provider, but no matching provider appeared in recent runtime events. Trigger the workflow and re-verify, or confirm calls bypass patched HTTP/fetch.",
      });
    }
  }

  if (!result.reachable && errors.length === 0) {
    errors.push("Could not reach the Spectyra dev bridge (no successful summary/events/waste response).");
  }

  return result;
}
