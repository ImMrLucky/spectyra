/**
 * Anonymous usage telemetry from the local companion (OpenClaw free path).
 * No authentication — keep payloads small; rate-limit at the edge in production if needed.
 */

import { Router } from "express";
import { query } from "../services/storage/db.js";
import { safeLog } from "../utils/redaction.js";

export const anonymousUsageRouter = Router();

const MAX_ID_LEN = 128;
const MAX_EVENT_LEN = 80;
const MAX_VER_LEN = 64;
const MAX_PLATFORM_LEN = 64;
const MAX_SOURCE_LEN = 32;

function clampStr(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/** Upsert installation heartbeat (idempotent on installation_id). */
anonymousUsageRouter.post("/ping", async (req, res) => {
  try {
    const installationId = clampStr(req.body?.installationId, MAX_ID_LEN);
    if (!installationId) {
      return res.status(400).json({ error: "installationId required" });
    }
    const appVersion = clampStr(req.body?.appVersion, MAX_VER_LEN);
    const platform = clampStr(req.body?.platform, MAX_PLATFORM_LEN);
    const source = clampStr(req.body?.source, MAX_SOURCE_LEN) || "openclaw";
    const notes =
      req.body?.notes && typeof req.body.notes === "object" && !Array.isArray(req.body.notes)
        ? req.body.notes
        : null;

    await query(
      `
      INSERT INTO anonymous_installations (installation_id, app_version, platform, source, last_seen_at, notes)
      VALUES ($1, $2, $3, $4, now(), $5::jsonb)
      ON CONFLICT (installation_id) DO UPDATE SET
        last_seen_at = now(),
        app_version = COALESCE(EXCLUDED.app_version, anonymous_installations.app_version),
        platform = COALESCE(EXCLUDED.platform, anonymous_installations.platform),
        source = COALESCE(EXCLUDED.source, anonymous_installations.source),
        notes = CASE WHEN EXCLUDED.notes IS NOT NULL THEN EXCLUDED.notes ELSE anonymous_installations.notes END
      `,
      [installationId, appVersion, platform, source, notes],
    );

    res.status(204).end();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    safeLog("error", "anonymous ping error", { error: msg });
    res.status(500).json({ error: msg });
  }
});

/** Append a usage event (best-effort; duplicates allowed). */
anonymousUsageRouter.post("/event", async (req, res) => {
  try {
    const installationId = clampStr(req.body?.installationId, MAX_ID_LEN);
    const eventName = clampStr(req.body?.eventName, MAX_EVENT_LEN);
    if (!installationId || !eventName) {
      return res.status(400).json({ error: "installationId and eventName required" });
    }
    const appVersion = clampStr(req.body?.appVersion, MAX_VER_LEN);
    const properties =
      req.body?.properties && typeof req.body.properties === "object" && !Array.isArray(req.body.properties)
        ? req.body.properties
        : null;

    await query(
      `
      INSERT INTO anonymous_usage_events (installation_id, event_name, app_version, properties)
      VALUES ($1, $2, $3, $4::jsonb)
      `,
      [installationId, eventName, appVersion, properties],
    );

    res.status(204).end();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal server error";
    safeLog("error", "anonymous event error", { error: msg });
    res.status(500).json({ error: msg });
  }
});
