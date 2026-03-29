/**
 * Map normalized SpectyraEvent stream into canonical state snapshots (generic payload keys only).
 */

import type { SpectyraEvent } from "@spectyra/event-core";
import type { CanonicalState } from "./types.js";

const PAYLOAD_EXTRACT_KEYS = [
  "estimatedInputTokens",
  "inputTokensBefore",
  "inputTokensAfter",
  "estimatedInputTokensAfter",
  "outputTokens",
  "inputTokens",
  "latencyMs",
  "success",
  "transformsApplied",
  "runMode",
  "mode",
] as const;

export type StateSnapshot = {
  eventId: string;
  timestamp: string;
  sessionId: string;
  runId: string;
  stepId: string;
  /** Merged analytics-shaped slice after this event. */
  state: CanonicalState;
};

function pickStateFields(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of PAYLOAD_EXTRACT_KEYS) {
    const v = payload[k];
    if (v === undefined || v === null) continue;
    if (typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
      out[k] = v;
      continue;
    }
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      out[k] = v;
    }
  }
  return out;
}

function stepKey(event: SpectyraEvent): string {
  return event.stepId?.trim() || "default_step";
}

const SNAPSHOT_TRIGGER_TYPES = new Set<SpectyraEvent["type"]>([
  "session_started",
  "step_started",
  "step_completed",
  "optimization_applied",
  "optimization_simulated",
  "provider_request_completed",
]);

/**
 * Fold events into a timeline of merged state snapshots (per session/step accumulation).
 */
export function extractStateSnapshotsFromSpectyraEvents(events: SpectyraEvent[]): StateSnapshot[] {
  const acc = new Map<string, CanonicalState>();
  const out: StateSnapshot[] = [];

  for (const event of events) {
    const sk = `${event.sessionId}:${stepKey(event)}`;
    const prev = acc.get(sk) ?? {};
    const patch = pickStateFields(event.payload);
    const meta: CanonicalState = {};
    if (event.model !== undefined) meta.eventModel = event.model;
    if (event.provider !== undefined) meta.eventProvider = event.provider;
    const merged: CanonicalState = { ...prev, ...patch, ...meta };
    acc.set(sk, merged);

    if (!SNAPSHOT_TRIGGER_TYPES.has(event.type)) continue;

    out.push({
      eventId: event.id,
      timestamp: event.timestamp,
      sessionId: event.sessionId,
      runId: event.runId,
      stepId: stepKey(event),
      state: { ...merged },
    });
  }

  return out;
}
