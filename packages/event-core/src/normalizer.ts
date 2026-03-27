import type { SpectyraEvent } from "./types.js";

function isIsoLike(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T/.test(s);
}

/** Light validation — does not mutate vendor payloads. */
export function assertNormalizedEvent(event: SpectyraEvent): void {
  if (!event.id || !event.type || !event.timestamp) {
    throw new Error("SpectyraEvent missing id, type, or timestamp");
  }
  if (!isIsoLike(event.timestamp)) {
    throw new Error("SpectyraEvent.timestamp must be ISO-8601");
  }
  if (!event.sessionId || !event.runId) {
    throw new Error("SpectyraEvent missing sessionId or runId");
  }
  if (!event.source?.adapterId || !event.source?.integrationType) {
    throw new Error("SpectyraEvent.source requires adapterId and integrationType");
  }
}
