import type { SessionAnalyticsRecord, StepAnalyticsRecord, AnalyticsSyncState } from "@spectyra/analytics-core";

/**
 * Snapshot for real-time UI — derived from normalized events + aggregation (not raw vendor payloads).
 */
export type LiveSessionState = {
  session: SessionAnalyticsRecord | null;
  currentStep?: StepAnalyticsRecord | null;
  recentSteps: StepAnalyticsRecord[];
  promptComparisonAvailable: boolean;
  syncState: AnalyticsSyncState;
};
