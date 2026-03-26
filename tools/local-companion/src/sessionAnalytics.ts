/**
 * Workflow session tracking for the Local Companion (real-time analytics, local persistence).
 */

import { promises as fs } from "fs";
import path from "path";
import { homedir } from "os";
import type { SavingsReport } from "@spectyra/core-types";
import { createSessionTracker, type SessionAnalyticsRecord, type SpectyraSessionTracker } from "@spectyra/analytics-core";
import type { CompanionConfig } from "./config.js";

const DATA_DIR = path.join(homedir(), ".spectyra", "companion");

function safeKey(sessionKey: string): string {
  return sessionKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "default";
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function writeCurrentForKey(sessionKey: string, snapshot: SessionAnalyticsRecord | null): Promise<void> {
  await ensureDir();
  const file = path.join(DATA_DIR, `current-session-${safeKey(sessionKey)}.json`);
  if (!snapshot) {
    try {
      await fs.unlink(file);
    } catch {
      /* noop */
    }
    return;
  }
  await fs.writeFile(file, JSON.stringify(snapshot, null, 2), "utf-8");
}

async function appendCompletedSession(rec: SessionAnalyticsRecord): Promise<void> {
  await ensureDir();
  const file = path.join(DATA_DIR, "sessions.jsonl");
  await fs.appendFile(file, JSON.stringify(rec) + "\n", "utf-8");
}

export async function getStoredSessionById(sessionId: string): Promise<SessionAnalyticsRecord | null> {
  const all = await listStoredSessions(100_000);
  return all.find((s) => s.sessionId === sessionId) ?? null;
}

export async function listStoredSessions(limit = 100): Promise<SessionAnalyticsRecord[]> {
  await ensureDir();
  const file = path.join(DATA_DIR, "sessions.jsonl");
  try {
    const raw = await fs.readFile(file, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l) as SessionAnalyticsRecord);
  } catch {
    return [];
  }
}

export async function readCurrentSessionForKey(sessionKey: string): Promise<SessionAnalyticsRecord | null> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, `current-session-${safeKey(sessionKey)}.json`), "utf-8");
    return JSON.parse(raw) as SessionAnalyticsRecord;
  } catch {
    return null;
  }
}

/**
 * Registry of active workflow sessions (keyed by x-spectyra-session-id or "default").
 */
export class CompanionSessionRegistry {
  private readonly trackers = new Map<string, SpectyraSessionTracker>();
  private readonly cfg: CompanionConfig;

  constructor(cfg: CompanionConfig) {
    this.cfg = cfg;
  }

  private makeTracker(): SpectyraSessionTracker {
    return createSessionTracker({
      mode: this.cfg.runMode,
      integrationType: "local-companion",
      telemetryMode: this.cfg.telemetryMode,
      promptSnapshotMode: this.cfg.promptSnapshots,
    });
  }

  sessionKeyFromRequest(headers: Record<string, string | string[] | undefined>): string {
    const raw =
      headers["x-spectyra-session-id"] ??
      headers["X-Spectyra-Session-Id"] ??
      headers["spectyra-session-id"];
    const v = Array.isArray(raw) ? raw[0] : raw;
    return typeof v === "string" && v.trim().length > 0 ? v.trim() : "default";
  }

  getOrCreateTracker(sessionKey: string): SpectyraSessionTracker {
    let t = this.trackers.get(sessionKey);
    if (!t) {
      t = this.makeTracker();
      this.trackers.set(sessionKey, t);
    }
    return t;
  }

  /** Record one LLM call as a step in the active session. */
  async recordStep(sessionKey: string, report: SavingsReport): Promise<void> {
    if (this.cfg.telemetryMode === "off") return;
    const tracker = this.getOrCreateTracker(sessionKey);
    tracker.recordStepFromReport(report);
    await writeCurrentForKey(sessionKey, tracker.getCurrentSession());
  }

  /** Finalize a session and persist to sessions.jsonl. */
  async completeSession(sessionKey: string): Promise<SessionAnalyticsRecord | null> {
    const t = this.trackers.get(sessionKey);
    if (!t) return null;
    const rec = t.finish();
    await appendCompletedSession(rec);
    await writeCurrentForKey(sessionKey, null);
    this.trackers.delete(sessionKey);
    return rec;
  }

  getLiveSnapshot(sessionKey: string): SessionAnalyticsRecord | null {
    const t = this.trackers.get(sessionKey);
    if (!t) return null;
    return t.getCurrentSession();
  }
}
