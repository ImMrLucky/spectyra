import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';

@Component({
  selector: 'app-desktop-compare',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Compare</h1>
        <p class="page-sub">Original vs optimized prompts — view diffs for any run.</p>
      </header>

      <!-- Topline -->
      <div class="topline" *ngIf="topline">
        <span class="chip" [class.actual]="topline.metricsPresentation === 'actual'"
              [class.projected]="topline.metricsPresentation === 'projected'">
          {{ topline.metricsPresentation === 'actual' ? 'Actual' : 'Projected' }}
        </span>
      </div>

      <!-- Quick path -->
      <div class="info-card">
        <h2 class="info-title">How to compare</h2>
        <ol class="info-steps">
          <li>Send traffic through the Local Companion.</li>
          <li>Open <a routerLink="/desktop/live">Live</a> → <strong>Prompt compare</strong> tab.</li>
          <li>Launch the local comparison viewer for the selected run.</li>
        </ol>
        <button class="btn-primary" routerLink="/desktop/live">Go to Live</button>
      </div>

      <!-- Recent sessions for quick access -->
      <div class="section" *ngIf="sessions.length">
        <h2 class="section-label">RECENT SESSIONS</h2>
        <div class="session-list">
          <div class="sl-row" *ngFor="let s of sessions.slice(0, 10)">
            <span class="sl-id mono">{{ s.sessionId | slice:0:8 }}…</span>
            <span class="sl-model">{{ s.model || '—' }}</span>
            <span class="sl-steps">{{ s.totalSteps }} steps</span>
            <span class="sl-transforms">
              <span class="sl-transform-chip" *ngFor="let t of (s.transformsApplied || []).slice(0, 3)">{{ t }}</span>
            </span>
            <span class="sl-saved mono teal">\${{ s.estimatedWorkflowSavings | number : '1.2-4' }}</span>
          </div>
        </div>
      </div>

      <div class="trust-msg" *ngIf="topline">
        <p>{{ topline.trustLine }}</p>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 900px;
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

      .info-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 20px;
        margin-bottom: 20px;
      }

      .info-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 12px;
      }

      .info-steps {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.7;
        padding-left: 1.2rem;
        margin: 0 0 16px;
      }

      .info-steps a {
        color: var(--spectyra-blue);
        text-decoration: none;
        &:hover { text-decoration: underline; }
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        padding: 8px 18px;
        background: var(--spectyra-navy);
        color: var(--spectyra-blue-pale);
        border: none;
        border-radius: 6px;
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        transition: background 0.15s ease;

        &:hover { background: var(--spectyra-navy-mid); }
      }

      .section { margin-bottom: 20px; }

      .section-label {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin: 0 0 10px;
      }

      .session-list {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        overflow: hidden;
      }

      .sl-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 8px 14px;
        border-bottom: 1px solid var(--border);
        font-size: 12px;

        &:last-child { border-bottom: none; }
        &:hover { background: var(--bg-elevated); }
      }

      .sl-id { color: var(--text-secondary); min-width: 80px; }
      .sl-model { color: var(--text-secondary); min-width: 80px; }
      .sl-steps { color: var(--text-muted); min-width: 60px; }

      .sl-transforms {
        flex: 1;
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
      }

      .sl-transform-chip {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 3px;
        background: rgba(55, 138, 221, 0.08);
        color: var(--spectyra-blue);
      }

      .sl-saved { min-width: 80px; text-align: right; }
      .mono { font-family: var(--font-mono); }
      .teal { color: #5DCAA5; }

      .trust-msg {
        padding: 14px 16px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);

        p {
          margin: 0;
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.5;
        }
      }
    `,
  ],
})
export class DesktopComparePage implements OnInit {
  sessions: SessionAnalyticsRecord[] = [];
  topline: LiveProductTopline | null = null;

  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
  ) {}

  async ngOnInit() {
    const h = await this.companion.fetchHealth();
    this.topline = this.trialUi.computeTopline(h);
    this.sessions = await this.companion.fetchSessions(30);
  }
}
