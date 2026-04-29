import type { SpectyraMonitorEvent } from "./monitorTypes.js";

declare global {
  interface Window {
    __SPECTYRA_MONITOR__?: {
      version: 1;
      lastEvent: SpectyraMonitorEvent | null;
      lastUpdated: string;
    };
  }
}

/** Browser-only: notify devtools / overlay without exposing secrets. */
export function emitMonitorEventToDevtoolsBus(ev: SpectyraMonitorEvent): void {
  if (typeof window === "undefined") return;
  try {
    window.__SPECTYRA_MONITOR__ = {
      version: 1,
      lastEvent: ev,
      lastUpdated: new Date().toISOString(),
    };
    window.dispatchEvent(new CustomEvent("spectyra-monitor", { detail: { eventId: ev.eventId } }));
  } catch {
    /* fail open */
  }
}
