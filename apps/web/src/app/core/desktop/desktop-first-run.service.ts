import { Injectable } from '@angular/core';

/**
 * Persists lightweight desktop-only UX flags (localStorage).
 * Used to send first-time users through Agent Companion before defaulting to Live.
 */
const AGENT_COMPANION_GUIDE_KEY = 'spectyra.desktop.guide.agentCompanionAck';

@Injectable({ providedIn: 'root' })
export class DesktopFirstRunService {
  /** User chose to continue to Live or dismissed the setup prompt — default startup can be Live. */
  hasAcknowledgedAgentCompanionGuide(): boolean {
    if (typeof localStorage === 'undefined') return true;
    return localStorage.getItem(AGENT_COMPANION_GUIDE_KEY) === '1';
  }

  acknowledgeAgentCompanionGuide(): void {
    try {
      localStorage.setItem(AGENT_COMPANION_GUIDE_KEY, '1');
    } catch {
      /* quota / private mode */
    }
  }
}
