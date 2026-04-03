/**
 * Tracks OpenClaw-originated traffic for safe diagnostics (no prompt content stored).
 */

import type { IncomingHttpHeaders } from "node:http";

let lastOpenClawRequestAt: string | null = null;

function looksLikeOpenClaw(headers: IncomingHttpHeaders): boolean {
  const integ = String(headers["x-spectyra-integration"] ?? "").toLowerCase();
  if (integ.includes("openclaw")) return true;
  const ua = String(headers["user-agent"] ?? "").toLowerCase();
  if (ua.includes("openclaw")) return true;
  return false;
}

/** Call at the start of inference routes. */
export function recordOpenClawTrafficIfApplicable(req: { headers: IncomingHttpHeaders }): void {
  if (looksLikeOpenClaw(req.headers)) {
    lastOpenClawRequestAt = new Date().toISOString();
  }
}

const CONNECTED_WINDOW_MS = 20 * 60 * 1000;

export function getOpenClawIntegrationDiagnostics(): {
  lastSeenRequestAt: string | null;
  detected: boolean;
  connected: boolean;
  configPresent: boolean;
} {
  const last = lastOpenClawRequestAt;
  const detected = last != null;
  let connected = false;
  if (last) {
    const t = new Date(last).getTime();
    if (!Number.isNaN(t) && Date.now() - t <= CONNECTED_WINDOW_MS) {
      connected = true;
    }
  }
  return {
    lastSeenRequestAt: last,
    detected,
    connected,
    configPresent: false,
  };
}
