import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { LiveTopBarComponent } from './live-top-bar.component';
import { AgentActivityPanelComponent } from './agent-activity-panel.component';
import { SpectyraIntelligencePanelComponent } from './spectyra-intelligence-panel.component';
import { LiveSessionService, type LiveDashboardSnapshot } from '../../../core/agent-companion/live-session.service';
import { CompanionEventStreamService } from '../../../core/agent-companion/companion-event-stream.service';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { CloudAnalyticsSyncService } from '../../../core/analytics/cloud-analytics-sync.service';
import { SupabaseService } from '../../../services/supabase.service';
import { environment } from '../../../../environments/environment';
import { DesktopFirstRunService } from '../../../core/desktop/desktop-first-run.service';
import type { LiveSessionState } from '@spectyra/event-core';
import type { SessionAnalyticsRecord, StepAnalyticsRecord } from '@spectyra/analytics-core';
import type { ExecutionGraphSummary, StateDeltaSummary, WorkflowPolicySummary } from '../../../core/analytics/companion-analytics.service';
import { interval, Subscription } from 'rxjs';

const SYNC_LS = 'spectyra_analytics_cloud_sync';

@Component({
  selector: 'app-live-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    LiveTopBarComponent,
    AgentActivityPanelComponent,
    SpectyraIntelligencePanelComponent,
  ],
  templateUrl: './live.page.html',
  styleUrls: ['./live.page.scss'],
})
export class LivePage implements OnInit, OnDestroy {
  readonly isDesktop = environment.isDesktop;
  loading = true;
  companionOrigin = '';
  sseConnected = false;
  lastEventLabel = '—';

  snapshot: LiveDashboardSnapshot | null = null;
  health: Record<string, unknown> | null = null;
  liveState: LiveSessionState | null = null;
  diskSession: SessionAnalyticsRecord | null = null;
  sessions: SessionAnalyticsRecord[] = [];
  stepRows: StepAnalyticsRecord[] = [];
  recentEvents: Array<{ type: string; timestamp: string; sessionId: string }> = [];
  executionSummary: ExecutionGraphSummary | null = null;
  stateDeltaSummary: StateDeltaSummary | null = null;
  workflowPolicySummary: WorkflowPolicySummary | null = null;

  stepColumns = ['idx', 'model', 'tokens', 'savings', 'transforms'];
  syncToCloud = false;
  canSyncAccount = false;
  syncing = false;

  /** Desktop: show until user dismisses or completes Agent Companion guidance. */
  showAgentCompanionSetupBanner = false;

  private poll?: Subscription;

  constructor(
    private liveSession: LiveSessionService,
    private companion: CompanionAnalyticsService,
    private eventStream: CompanionEventStreamService,
    public cloudSync: CloudAnalyticsSyncService,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
    private firstRun: DesktopFirstRunService,
  ) {}

  ngOnInit() {
    this.showAgentCompanionSetupBanner =
      this.isDesktop && !this.firstRun.hasAcknowledgedAgentCompanionGuide();
    this.syncToCloud = typeof localStorage !== 'undefined' && localStorage.getItem(SYNC_LS) === 'true';
    void this.bootstrap();
    this.poll = interval(4000).subscribe(() => void this.refresh(false));
  }

  ngOnDestroy() {
    this.poll?.unsubscribe();
    this.eventStream.disconnect();
  }

  private async bootstrap() {
    this.loading = true;
    this.companionOrigin = await this.companion.resolveCompanionOrigin();
    await this.refresh(true);
    this.canSyncAccount = await this.cloudSync.canSync();
    await this.eventStream.connect(
      ({ eventType }) => {
        if (eventType) this.lastEventLabel = eventType;
        if (
          eventType === 'session_finished' ||
          eventType === 'optimization_applied' ||
          eventType === 'provider_request_completed'
        ) {
          void this.refresh(false).then(() => {
            if (eventType === 'session_finished' && this.syncToCloud) void this.trySyncLatestSession();
          });
        }
        this.cdr.markForCheck();
      },
      () => {
        this.sseConnected = true;
        this.cdr.markForCheck();
      },
      () => {
        this.sseConnected = false;
        this.cdr.markForCheck();
      },
    );
    this.loading = false;
    this.cdr.markForCheck();
  }

  private async refresh(showSpinner: boolean) {
    if (showSpinner) this.loading = true;
    try {
      const snap = await this.liveSession.fetchDashboardSnapshot();
      this.snapshot = snap;
      this.health = snap.health;
      this.liveState = snap.liveState;
      this.diskSession = snap.diskSession;
      this.sessions = snap.sessions;
      this.stepRows = snap.stepRows;
      this.recentEvents = snap.recentEvents;
      this.executionSummary = snap.executionSummary;
      this.stateDeltaSummary = snap.stateDeltaSummary;
      this.workflowPolicySummary = snap.workflowPolicySummary;
    } finally {
      if (showSpinner) this.loading = false;
      this.cdr.markForCheck();
    }
  }

  activeSession(): SessionAnalyticsRecord | null {
    return this.liveState?.session ?? this.diskSession;
  }

  async trySyncLatestSession() {
    if (!this.syncToCloud) return;
    const token = await this.supabase.getAccessToken();
    if (!token) return;
    const s = this.liveState?.session || this.diskSession || this.sessions[this.sessions.length - 1];
    if (!s?.sessionId) return;
    this.syncing = true;
    this.cdr.markForCheck();
    await this.cloudSync.syncSessionSummary(s);
    this.syncing = false;
    this.cdr.markForCheck();
  }

  onSyncToggle(on: boolean) {
    this.syncToCloud = on;
    localStorage.setItem(SYNC_LS, on ? 'true' : 'false');
    if (on) void this.trySyncLatestSession();
  }

  dismissAgentCompanionSetupBanner() {
    this.firstRun.acknowledgeAgentCompanionGuide();
    this.showAgentCompanionSetupBanner = false;
    this.cdr.markForCheck();
  }

  async openPromptComparison(runId: string) {
    const url = await this.companion.promptComparisonUrl(runId);
    window.open(url, '_blank', 'noopener');
  }

  tokenSavedInput(s: SessionAnalyticsRecord | null): number {
    if (!s) return 0;
    return Math.max(0, (s.totalInputTokensBefore ?? 0) - (s.totalInputTokensAfter ?? 0));
  }
}
