import { Injectable } from '@angular/core';
import { CompanionAnalyticsService } from '../analytics/companion-analytics.service';
import type { ExecutionGraphSummary, StateDeltaSummary, WorkflowPolicySummary } from '../analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from './trial-license-ui.service';
import type { LiveSessionState } from '@spectyra/event-core';
import type { SessionAnalyticsRecord, StepAnalyticsRecord } from '@spectyra/analytics-core';
import type { SpectyraEvent } from '@spectyra/event-core';

export interface LiveDashboardSnapshot {
  health: Record<string, unknown> | null;
  topline: LiveProductTopline;
  liveState: LiveSessionState | null;
  diskSession: SessionAnalyticsRecord | null;
  sessions: SessionAnalyticsRecord[];
  executionSummary: ExecutionGraphSummary | null;
  stateDeltaSummary: StateDeltaSummary | null;
  workflowPolicySummary: WorkflowPolicySummary | null;
  recentEvents: Array<{ type: string; timestamp: string; sessionId: string }>;
  stepRows: StepAnalyticsRecord[];
}

/**
 * Aggregates companion HTTP + trial topline for the Live split dashboard.
 */
@Injectable({ providedIn: 'root' })
export class LiveSessionService {
  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
  ) {}

  async fetchDashboardSnapshot(limitSessions = 40, limitEvents = 48): Promise<LiveDashboardSnapshot> {
    const [
      health,
      liveState,
      diskSession,
      sessions,
      executionSummary,
      stateDeltaSummary,
      workflowPolicySummary,
      ev,
    ] = await Promise.all([
      this.companion.fetchHealth(),
      this.companion.fetchLiveState(),
      this.companion.fetchCurrentSession(),
      this.companion.fetchSessions(limitSessions),
      this.companion.fetchExecutionGraphSummary(),
      this.companion.fetchStateDeltaSummary(),
      this.companion.fetchWorkflowPolicySummary(),
      this.companion.fetchRecentNormalizedEvents(limitEvents),
    ]);

    const recentEvents = (ev?.events ?? []).map((e: SpectyraEvent) => ({
      type: e.type,
      timestamp: e.timestamp,
      sessionId: e.sessionId?.slice(0, 8) ?? '—',
    }));

    const stepRows = liveState?.recentSteps?.length
      ? [...liveState.recentSteps].reverse()
      : [];

    return {
      health,
      topline: this.trialUi.computeTopline(health),
      liveState,
      diskSession,
      sessions,
      executionSummary,
      stateDeltaSummary,
      workflowPolicySummary,
      recentEvents,
      stepRows,
    };
  }
}
