import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDividerModule } from '@angular/material/divider';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CompanionAnalyticsService } from '../../core/analytics/companion-analytics.service';
import { CloudAnalyticsSyncService } from '../../core/analytics/cloud-analytics-sync.service';
import { SupabaseService } from '../../services/supabase.service';
import { environment } from '../../../environments/environment';
import type { LiveSessionState } from '@spectyra/event-core';
import type { SessionAnalyticsRecord, StepAnalyticsRecord } from '@spectyra/analytics-core';
import { interval, Subscription } from 'rxjs';

const SYNC_LS = 'spectyra_analytics_cloud_sync';

@Component({
  selector: 'app-live-savings',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatDividerModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './live-savings.page.html',
  styleUrls: ['./live-savings.page.scss'],
})
export class LiveSavingsPage implements OnInit, OnDestroy {
  readonly isDesktop = environment.isDesktop;
  loading = true;
  companionOrigin = '';
  health: Record<string, unknown> | null = null;
  liveState: LiveSessionState | null = null;
  diskSession: SessionAnalyticsRecord | null = null;
  sessions: SessionAnalyticsRecord[] = [];
  sseConnected = false;
  lastEventLabel = '—';

  syncToCloud = false;
  canSyncAccount = false;
  syncing = false;

  stepColumns = ['idx', 'model', 'tokens', 'savings', 'transforms'];
  stepRows: StepAnalyticsRecord[] = [];

  private poll?: Subscription;
  private es?: EventSource;

  constructor(
    private companion: CompanionAnalyticsService,
    public cloudSync: CloudAnalyticsSyncService,
    private supabase: SupabaseService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit() {
    this.syncToCloud = typeof localStorage !== 'undefined' && localStorage.getItem(SYNC_LS) === 'true';
    void this.bootstrap();
    this.poll = interval(4000).subscribe(() => void this.refreshData(false));
  }

  ngOnDestroy() {
    this.poll?.unsubscribe();
    this.es?.close();
  }

  private async bootstrap() {
    this.loading = true;
    this.companionOrigin = await this.companion.resolveCompanionOrigin();
    await this.refreshData(true);
    this.canSyncAccount = await this.cloudSync.canSync();
    this.startSse();
    this.loading = false;
    this.cdr.markForCheck();
  }

  private async refreshData(showSpinner: boolean) {
    if (showSpinner) this.loading = true;
    try {
      this.health = await this.companion.fetchHealth();
      this.liveState = await this.companion.fetchLiveState();
      this.diskSession = await this.companion.fetchCurrentSession();
      this.sessions = await this.companion.fetchSessions(40);
      this.stepRows = this.liveState?.recentSteps?.length
        ? [...this.liveState.recentSteps].reverse()
        : [];
    } finally {
      if (showSpinner) this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private startSse() {
    void this.companion.liveEventsUrl().then((url) => {
      try {
        this.es = new EventSource(url);
        this.es.onopen = () => {
          this.sseConnected = true;
          this.cdr.markForCheck();
        };
        this.es.onerror = () => {
          this.sseConnected = false;
          this.cdr.markForCheck();
        };
        this.es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data) as { v?: number; event?: { type?: string } };
            const t = data?.event?.type;
            if (t) this.lastEventLabel = t;
            if (t === 'session_finished' || t === 'optimization_applied' || t === 'provider_request_completed') {
              void (async () => {
                await this.refreshData(false);
                if (t === 'session_finished' && this.syncToCloud) await this.trySyncLatestSession();
                this.cdr.markForCheck();
              })();
            }
          } catch {
            /* ignore */
          }
          this.cdr.markForCheck();
        };
      } catch {
        this.sseConnected = false;
      }
    });
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

  async openPromptComparison(runId: string) {
    const url = await this.companion.promptComparisonUrl(runId);
    window.open(url, '_blank', 'noopener');
  }

  /** Prefer live engine snapshot; fall back to file-backed current session. */
  activeSession(): SessionAnalyticsRecord | null {
    return this.liveState?.session ?? this.diskSession;
  }

  tokenSavedInput(s: SessionAnalyticsRecord | null): number {
    if (!s) return 0;
    return Math.max(0, (s.totalInputTokensBefore ?? 0) - (s.totalInputTokensAfter ?? 0));
  }
}
