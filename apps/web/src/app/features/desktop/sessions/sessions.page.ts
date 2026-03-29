import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';

const SOURCE_LABELS: Record<string, string> = {
  'sdk-wrapper': 'SDK',
  'local-companion': 'Companion',
  'openclaw-jsonl': 'OpenClaw',
  'claude-hooks': 'Claude',
  'claude-jsonl': 'Claude',
  'openai-tracing': 'OpenAI',
  'generic-jsonl': 'Generic',
  unknown: 'Unknown',
};

@Component({
  selector: 'app-desktop-sessions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Sessions</h1>
        <p class="page-sub">Active and recent workflow sessions from your Local Companion.</p>
      </header>

      <!-- Topline badges -->
      <div class="topline" *ngIf="topline">
        <span class="chip opt">{{ topline.optimizationHeadline }}</span>
        <span class="chip trial" *ngIf="topline.trialBadge === 'Trial Active'">
          Trial · {{ topline.trialDaysLeft }}d left
        </span>
        <span class="chip trial-ended" *ngIf="topline.trialBadge === 'Trial Ended'">Trial ended</span>
        <span class="chip metrics" [class.projected]="topline.metricsPresentation === 'projected'">
          {{ topline.metricsPresentation === 'actual' ? 'Actual savings' : 'Projected savings' }}
        </span>
      </div>

      <!-- Active session -->
      <div class="active-session" *ngIf="activeSession">
        <div class="as-header">
          <span class="as-dot"></span>
          <span class="as-label">Active session</span>
        </div>
        <div class="as-body">
          <div class="as-metric">
            <span class="as-k">Session</span>
            <span class="as-v mono">{{ activeSession.sessionId | slice:0:10 }}…</span>
          </div>
          <div class="as-metric">
            <span class="as-k">Source</span>
            <span class="as-v">{{ sourceLabel(activeSession.integrationType) }}</span>
          </div>
          <div class="as-metric">
            <span class="as-k">Steps</span>
            <span class="as-v">{{ activeSession.totalSteps }}</span>
          </div>
          <div class="as-metric">
            <span class="as-k">Saved</span>
            <span class="as-v teal">\${{ activeSession.estimatedWorkflowSavings | number : '1.2-4' }}</span>
          </div>
        </div>
      </div>

      <!-- Sessions table -->
      <div class="table-card">
        <table class="dt-table" *ngIf="sessions.length">
          <thead>
            <tr>
              <th>Session</th>
              <th>Source</th>
              <th>Model</th>
              <th>Steps</th>
              <th>Tokens saved</th>
              <th>Est. saved</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of sessions" [class.active-row]="!s.endedAt">
              <td class="mono session-id">{{ s.sessionId | slice:0:10 }}…</td>
              <td>
                <span class="source-badge">{{ sourceLabel(s.integrationType) }}</span>
              </td>
              <td>{{ s.model || '—' }}</td>
              <td>{{ s.totalSteps }}</td>
              <td class="mono">{{ tokensSaved(s) | number }}</td>
              <td class="mono teal">\${{ s.estimatedWorkflowSavings | number : '1.2-2' }}</td>
              <td>
                <span class="status-chip" [class.running]="!s.endedAt" [class.done]="!!s.endedAt">
                  {{ s.endedAt ? 'completed' : 'running' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <p class="empty-msg" *ngIf="!sessions.length">No sessions yet — use the Live view while traffic runs.</p>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 1080px;
        margin: 0 auto;
        padding: 24px 20px 48px;
        font-family: var(--font-body);
      }

      .page-header { margin-bottom: 20px; }

      .page-title {
        margin: 0 0 6px;
        font-family: var(--font-display);
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .page-sub {
        color: var(--text-secondary);
        font-size: 13px;
        margin: 0;
      }

      .topline {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 16px;
      }

      .chip {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 3px 8px;
        border-radius: 4px;
      }

      .chip.opt {
        background: var(--spectyra-teal-pale);
        border: 1px solid var(--spectyra-teal-border);
        color: var(--spectyra-teal);
      }

      .chip.trial {
        background: var(--spectyra-amber-pale);
        border: 1px solid var(--spectyra-amber-border);
        color: var(--spectyra-amber-light);
      }

      .chip.trial-ended {
        background: rgba(186, 117, 23, 0.12);
        border: 1px solid var(--spectyra-amber-border);
        color: var(--spectyra-amber);
      }

      .chip.metrics {
        background: rgba(55, 138, 221, 0.08);
        border: 1px solid rgba(55, 138, 221, 0.2);
        color: var(--spectyra-blue);
      }

      .chip.metrics.projected {
        background: var(--spectyra-amber-pale);
        border: 1px solid var(--spectyra-amber-border);
        color: var(--spectyra-amber-light);
      }

      .active-session {
        background: var(--bg-card);
        border: 1px solid var(--spectyra-teal-border);
        border-radius: var(--radius-card);
        padding: 14px 16px;
        margin-bottom: 16px;
      }

      .as-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      .as-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--spectyra-teal);
        animation: pulse 2s ease-in-out infinite;
      }

      .as-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }

      .as-body {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 10px;
      }

      .as-metric {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .as-k {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
      }

      .as-v {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .as-v.teal { color: #5DCAA5; }

      .table-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        overflow: hidden;
      }

      .dt-table {
        width: 100%;
        border-collapse: collapse;
      }

      .dt-table th {
        text-align: left;
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        padding: 10px 12px;
        background: var(--bg-elevated);
        border-bottom: 1px solid var(--border);
      }

      .dt-table td {
        font-size: 12px;
        color: var(--text-primary);
        padding: 9px 12px;
        border-bottom: 1px solid var(--border);
      }

      .dt-table tr:hover td {
        background: var(--bg-elevated);
      }

      .dt-table tr.active-row td {
        background: rgba(29, 158, 117, 0.04);
      }

      .mono { font-family: var(--font-mono); }

      .session-id { color: var(--text-secondary); }
      .teal { color: #5DCAA5; }

      .source-badge {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 2px 6px;
        border-radius: 3px;
        background: rgba(55, 138, 221, 0.08);
        color: var(--spectyra-blue);
      }

      .status-chip {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .status-chip.running {
        background: var(--spectyra-teal-pale);
        color: var(--spectyra-teal);
      }

      .status-chip.done {
        background: rgba(55, 138, 221, 0.06);
        color: var(--text-secondary);
      }

      .empty-msg {
        color: var(--text-muted);
        font-size: 12px;
        padding: 20px 16px;
        margin: 0;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
    `,
  ],
})
export class DesktopSessionsPage implements OnInit {
  sessions: SessionAnalyticsRecord[] = [];
  activeSession: SessionAnalyticsRecord | null = null;
  topline: LiveProductTopline | null = null;

  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
  ) {}

  async ngOnInit() {
    const h = await this.companion.fetchHealth();
    this.topline = this.trialUi.computeTopline(h);
    this.sessions = await this.companion.fetchSessions(60);
    this.activeSession = this.sessions.find((s) => !s.endedAt) ?? null;
  }

  sourceLabel(type: string | undefined): string {
    return SOURCE_LABELS[type ?? 'unknown'] ?? type ?? '—';
  }

  tokensSaved(s: SessionAnalyticsRecord): number {
    return Math.max(0, (s.totalInputTokensBefore ?? 0) - (s.totalInputTokensAfter ?? 0));
  }
}
