/**
 * Upload redacted session summaries to Spectyra API when the user is signed in (Supabase JWT).
 * Mirrors apps/web CloudAnalyticsSyncService — same POST /v1/analytics/sessions.
 */

import { sessionToSyncedPayload } from "@spectyra/analytics-core";
import type { SessionAnalyticsRecord } from "@spectyra/analytics-core";
import type { CompanionConfig } from "./config.js";
import { resolveSpectyraCloudApiV1Base } from "./cloudDefaults.js";
import { getValidSupabaseAccessToken, loadDesktopConfig } from "./desktopSession.js";

function spectyraApiBase(): string {
  return resolveSpectyraCloudApiV1Base();
}

export function shouldAttemptCloudAnalyticsSync(cfg: CompanionConfig): boolean {
  if (cfg.telemetryMode === "off") return false;
  if (process.env.SPECTYRA_SYNC_ANALYTICS === "false") return false;
  if (!cfg.syncAnalyticsToCloud) return false;
  return true;
}

const throttleLastAt = new Map<string, number>();
const THROTTLE_MS = 60_000;

/** Throttled snapshot sync while a session is still active (OpenClaw rarely calls /session/complete). */
export function maybeThrottleCloudSync(
  sessionKey: string,
  rec: SessionAnalyticsRecord | null,
  cfg: CompanionConfig,
): void {
  if (!rec || !shouldAttemptCloudAnalyticsSync(cfg)) return;
  const now = Date.now();
  const last = throttleLastAt.get(sessionKey) ?? 0;
  if (now - last < THROTTLE_MS) return;
  throttleLastAt.set(sessionKey, now);
  void syncSessionSummaryToCloud(rec, cfg);
}

export async function syncSessionSummaryToCloud(
  rec: SessionAnalyticsRecord | null,
  cfg: CompanionConfig,
): Promise<void> {
  if (!rec || !shouldAttemptCloudAnalyticsSync(cfg)) return;
  const config = loadDesktopConfig();
  const token = await getValidSupabaseAccessToken(config);
  if (!token) return;
  const base = spectyraApiBase().replace(/\/$/, "");
  const url = `${base}/analytics/sessions`;
  const payload = sessionToSyncedPayload(rec);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok && process.env.DEBUG_SPECTYRA_SYNC === "true") {
    const text = await res.text().catch(() => "");
    console.error(`[spectyra-companion] cloud analytics sync failed ${res.status}: ${text.slice(0, 500)}`);
  }
}
