import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { LiveSessionState } from '@spectyra/event-core';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';

/** Companion HTTP API — local-first; no Spectyra cloud for these calls. */
@Injectable({ providedIn: 'root' })
export class CompanionAnalyticsService {
  /** Origin only, e.g. http://127.0.0.1:4111 (port matches desktop config when in Electron). */
  async resolveCompanionOrigin(): Promise<string> {
    if (environment.isDesktop && typeof window !== 'undefined' && window.spectyra?.app?.companionBaseUrl) {
      try {
        const u = await window.spectyra.app.companionBaseUrl();
        return new URL(u).origin;
      } catch {
        /* fall through */
      }
    }
    return environment.companionBaseUrl.replace(/\/$/, '');
  }

  async fetchHealth(): Promise<Record<string, unknown> | null> {
    const origin = await this.resolveCompanionOrigin();
    try {
      const r = await fetch(`${origin}/health`);
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  async fetchLiveState(): Promise<LiveSessionState | null> {
    const origin = await this.resolveCompanionOrigin();
    try {
      const r = await fetch(`${origin}/v1/analytics/live-state`);
      if (!r.ok) return null;
      return (await r.json()) as LiveSessionState;
    } catch {
      return null;
    }
  }

  async fetchCurrentSession(): Promise<SessionAnalyticsRecord | null> {
    const origin = await this.resolveCompanionOrigin();
    try {
      const r = await fetch(`${origin}/v1/analytics/current-session`);
      if (!r.ok) return null;
      const j = await r.json();
      if (!j || typeof j !== 'object' || !('sessionId' in j)) return null;
      return j as SessionAnalyticsRecord;
    } catch {
      return null;
    }
  }

  async fetchSessions(limit = 50): Promise<SessionAnalyticsRecord[]> {
    const origin = await this.resolveCompanionOrigin();
    try {
      const r = await fetch(`${origin}/v1/analytics/sessions?limit=${limit}`);
      if (!r.ok) return [];
      return (await r.json()) as SessionAnalyticsRecord[];
    } catch {
      return [];
    }
  }

  async fetchSessionById(sessionId: string): Promise<SessionAnalyticsRecord | null> {
    const origin = await this.resolveCompanionOrigin();
    try {
      const r = await fetch(`${origin}/v1/analytics/session/${encodeURIComponent(sessionId)}`);
      if (!r.ok) return null;
      return (await r.json()) as SessionAnalyticsRecord;
    } catch {
      return null;
    }
  }

  /** SSE URL for normalized SpectyraEvent stream. */
  async liveEventsUrl(): Promise<string> {
    const origin = await this.resolveCompanionOrigin();
    return `${origin}/v1/analytics/live-events`;
  }

  promptComparisonUrl(runId: string): Promise<string> {
    return this.resolveCompanionOrigin().then((o) => `${o}/v1/analytics/prompt-comparison/${encodeURIComponent(runId)}`);
  }
}
