import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';

interface Rollup {
  label: string;
  sessions: number;
  saved: number;
  tokens: number;
  steps: number;
}

@Component({
  selector: 'app-desktop-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">History</h1>
        <p class="page-sub">Rollups from local sessions — same data as cloud analytics when you sync.</p>
      </header>

      <!-- Topline -->
      <div class="topline" *ngIf="topline">
        <span class="chip" [class.actual]="topline.metricsPresentation === 'actual'"
              [class.projected]="topline.metricsPresentation === 'projected'">
          {{ topline.metricsPresentation === 'actual' ? 'Actual' : 'Projected' }}
        </span>
        <span class="chip trial" *ngIf="topline.trialBadge === 'Trial Active'">Trial · {{ topline.trialDaysLeft }}d</span>
      </div>

      <!-- KPI grid -->
      <div class="kpi-grid">
        <div class="kpi-card" *ngFor="let r of rollups">
          <span class="kpi-label">{{ r.label }}</span>
          <span class="kpi-value">\${{ r.saved | number : '1.2-2' }}</span>
          <div class="kpi-meta">
            <span>{{ r.sessions }} session{{ r.sessions !== 1 ? 's' : '' }}</span>
            <span>{{ r.tokens | number }} tokens saved</span>
            <span>{{ r.steps }} steps</span>
          </div>
        </div>
      </div>

      <!-- Lifetime summary -->
      <div class="summary-card">
        <div class="sc-row">
          <div class="sc-metric">
            <span class="sc-label">Total sessions</span>
            <span class="sc-value">{{ sessions.length }}</span>
          </div>
          <div class="sc-metric">
            <span class="sc-label">Lifetime saved</span>
            <span class="sc-value teal">\${{ lifetimeSaved | number : '1.2-2' }}</span>
          </div>
          <div class="sc-metric">
            <span class="sc-label">Avg. savings %</span>
            <span class="sc-value">{{ avgSavingsPct | number : '1.0-1' }}%</span>
          </div>
        </div>
      </div>

      <!-- Recent sessions mini-list -->
      <div class="recent-section" *ngIf="sessions.length">
        <h2 class="section-label">RECENT SESSIONS</h2>
        <div class="recent-list">
          <div class="rl-row" *ngFor="let s of sessions.slice(0, 20)">
            <span class="rl-id mono">{{ s.sessionId | slice:0:8 }}…</span>
            <span class="rl-model">{{ s.model || '—' }}</span>
            <span class="rl-saved mono teal">\${{ s.estimatedWorkflowSavings | number : '1.2-4' }}</span>
            <span class="rl-steps">{{ s.totalSteps }} steps</span>
            <span class="rl-time mono">{{ s.startedAt | slice:0:10 }}</span>
          </div>
        </div>
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

      .page-sub { color: var(--text-secondary); font-size: 13px; margin: 0; }

      .topline {
        display: flex;
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

      .chip.actual {
        background: var(--spectyra-teal-pale);
        border: 1px solid var(--spectyra-teal-border);
        color: var(--spectyra-teal);
      }

      .chip.projected {
        background: var(--spectyra-amber-pale);
        border: 1px solid var(--spectyra-amber-border);
        color: var(--spectyra-amber-light);
      }

      .chip.trial {
        background: var(--spectyra-amber-pale);
        border: 1px solid var(--spectyra-amber-border);
        color: var(--spectyra-amber-light);
      }

      /* ── KPI grid ── */
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
        margin-bottom: 16px;
      }

      .kpi-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 16px;
      }

      .kpi-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        display: block;
        margin-bottom: 8px;
      }

      .kpi-value {
        font-family: var(--font-mono);
        font-size: 22px;
        font-weight: 500;
        color: var(--spectyra-teal-light);
        display: block;
        margin-bottom: 8px;
      }

      .kpi-meta {
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-size: 11px;
        color: var(--text-muted);
      }

      /* ── Summary card ── */
      .summary-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 16px;
        margin-bottom: 20px;
      }

      .sc-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 16px;
      }

      .sc-metric {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .sc-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }

      .sc-value {
        font-family: var(--font-mono);
        font-size: 18px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .sc-value.teal { color: #5DCAA5; }

      /* ── Recent list ── */
      .section-label {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin: 0 0 10px;
      }

      .recent-list {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        overflow: hidden;
      }

      .rl-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 14px;
        border-bottom: 1px solid var(--border);
        font-size: 12px;

        &:last-child { border-bottom: none; }
        &:hover { background: var(--bg-elevated); }
      }

      .rl-id { color: var(--text-secondary); min-width: 80px; }
      .rl-model { flex: 1; color: var(--text-secondary); }
      .rl-saved { color: #5DCAA5; min-width: 80px; }
      .rl-steps { color: var(--text-muted); min-width: 60px; }
      .rl-time { color: var(--text-muted); font-size: 11px; }
      .mono { font-family: var(--font-mono); }
      .teal { color: #5DCAA5; }
    `,
  ],
})
export class DesktopHistoryPage implements OnInit {
  sessions: SessionAnalyticsRecord[] = [];
  topline: LiveProductTopline | null = null;
  rollups: Rollup[] = [];
  lifetimeSaved = 0;
  avgSavingsPct = 0;

  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
  ) {}

  async ngOnInit() {
    const h = await this.companion.fetchHealth();
    this.topline = this.trialUi.computeTopline(h);
    this.sessions = await this.companion.fetchSessions(200);
    this.computeRollups();
  }

  private computeRollups() {
    const now = Date.now();
    const day = 86400000;
    const ranges = [
      { label: 'Today', ms: day },
      { label: 'This week', ms: 7 * day },
      { label: 'This month', ms: 30 * day },
    ];

    this.rollups = ranges.map((r) => {
      let saved = 0, tokens = 0, steps = 0, count = 0;
      for (const s of this.sessions) {
        const started = Date.parse(s.startedAt);
        if (Number.isNaN(started) || now - started > r.ms) continue;
        saved += s.estimatedWorkflowSavings ?? 0;
        tokens += Math.max(0, (s.totalInputTokensBefore ?? 0) - (s.totalInputTokensAfter ?? 0));
        steps += s.totalSteps ?? 0;
        count++;
      }
      return { label: r.label, sessions: count, saved, tokens, steps };
    });

    this.lifetimeSaved = this.sessions.reduce((a, s) => a + (s.estimatedWorkflowSavings ?? 0), 0);

    const pcts = this.sessions
      .filter((s) => s.estimatedWorkflowSavingsPct != null)
      .map((s) => s.estimatedWorkflowSavingsPct!);
    this.avgSavingsPct = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
  }
}
