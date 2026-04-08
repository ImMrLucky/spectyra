import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';

@Component({
  selector: 'app-desktop-security',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Security & Trust</h1>
        <p class="page-sub">Local-first defaults — your provider keys, your machine, your control.</p>
      </header>

      <!-- Trust grid -->
      <div class="trust-grid" *ngIf="topline">
        <div class="trust-card primary">
          <div class="tc-icon-row">
            <span class="material-icons tc-icon">lock</span>
            <span class="tc-badge safe">Local</span>
          </div>
          <h3 class="tc-title">Runs locally</h3>
          <p class="tc-desc">
            The Local Companion listens on localhost only. Inference requests go
            directly to your provider — no Spectyra cloud relay.
          </p>
        </div>

        <div class="trust-card">
          <div class="tc-icon-row">
            <span class="material-icons tc-icon">credit_card</span>
            <span class="tc-badge safe">Your account</span>
          </div>
          <h3 class="tc-title">Your provider billing</h3>
          <p class="tc-desc">
            Billing stays on your provider account (OpenAI, Anthropic, etc.).
            Spectyra never uses its own API keys for your inference.
          </p>
        </div>

        <div class="trust-card">
          <div class="tc-icon-row">
            <span class="material-icons tc-icon">visibility</span>
          </div>
          <h3 class="tc-title">Telemetry</h3>
          <p class="tc-desc mono-val">{{ telemetry }}</p>
          <p class="tc-detail" *ngIf="telemetry === 'local'">
            All analytics data stays on your machine. Nothing is sent to Spectyra servers
            unless you explicitly enable cloud sync.
          </p>
          <p class="tc-detail" *ngIf="telemetry === 'off'">
            Telemetry is off. Monitoring, sessions, and analytics are not captured.
          </p>
        </div>

        <div class="trust-card">
          <div class="tc-icon-row">
            <span class="material-icons tc-icon">tune</span>
          </div>
          <h3 class="tc-title">Optimization mode</h3>
          <p class="tc-desc mono-val">{{ topline.optimizationHeadline }}</p>
          <p class="tc-detail">{{ topline.trustLine }}</p>
        </div>

        <div class="trust-card">
          <div class="tc-icon-row">
            <span class="material-icons tc-icon">verified</span>
          </div>
          <h3 class="tc-title">License & trial</h3>
          <p class="tc-desc mono-val">
            {{ topline.trialBadge || '—' }}
            <span *ngIf="topline.trialDaysLeft !== null"> · {{ topline.trialDaysLeft }}d remaining</span>
          </p>
          <p class="tc-detail">
            {{ topline.metricsPresentation === 'actual' ? 'Savings are actual (optimization active).' : 'Savings are projected (observe mode).' }}
          </p>
        </div>

        <div class="trust-card">
          <div class="tc-icon-row">
            <span class="material-icons tc-icon">sync</span>
          </div>
          <h3 class="tc-title">Cloud sync</h3>
          <p class="tc-desc mono-val">{{ syncStatus }}</p>
          <p class="tc-detail">
            When enabled, only redacted session summaries are synced.
            Raw prompts, tool output, and provider keys are never sent.
          </p>
        </div>
      </div>

      <!-- Safety pledge -->
      <div class="pledge-card">
        <h3 class="pledge-title">Spectyra safety pledge</h3>
        <ul class="pledge-list">
          <li>Your agent keeps working even with Spectyra off, in observe mode, or after trial expiry.</li>
          <li>Spectyra never blocks the underlying provider call when optimization is off.</li>
          <li>Prompt text stays local by default — cloud sync is opt-in and redacted.</li>
          <li>No inference data is used for training any model.</li>
        </ul>
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

      .page-header { margin-bottom: 24px; }

      .page-title {
        margin: 0 0 6px;
        font-family: var(--font-display);
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .page-sub { color: var(--text-secondary); font-size: 13px; margin: 0; }

      /* ── Trust grid ── */
      .trust-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }

      .trust-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 18px;
      }

      .trust-card.primary {
        border-color: var(--spectyra-teal-border);
      }

      .tc-icon-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
      }

      .tc-icon {
        font-size: 18px;
        color: var(--spectyra-blue);
      }

      .tc-badge {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 2px 6px;
        border-radius: 3px;
      }

      .tc-badge.safe {
        background: var(--spectyra-teal-pale);
        color: var(--spectyra-teal);
        border: 1px solid var(--spectyra-teal-border);
      }

      .tc-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 6px;
      }

      .tc-desc {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
        margin: 0;
      }

      .tc-desc.mono-val {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--spectyra-blue-light);
        margin-bottom: 6px;
      }

      .tc-detail {
        font-size: 11px;
        color: var(--text-muted);
        line-height: 1.5;
        margin: 0;
      }

      /* ── Pledge ── */
      .pledge-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 20px;
      }

      .pledge-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 12px;
      }

      .pledge-list {
        margin: 0;
        padding-left: 1.1rem;
        line-height: 1.7;
        font-size: 12px;
        color: var(--text-secondary);
      }
    `,
  ],
})
export class DesktopSecurityPage implements OnInit {
  topline: LiveProductTopline | null = null;
  telemetry = '—';
  syncStatus = 'Off (local only)';

  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
  ) {}

  async ngOnInit() {
    const h = await this.companion.fetchHealth();
    this.topline = this.trialUi.computeTopline(h);
    this.telemetry = String(h?.['telemetryMode'] ?? 'local');

    if (typeof localStorage !== 'undefined') {
      const syncOn = localStorage.getItem('spectyra_analytics_cloud_sync') === 'true';
      this.syncStatus = syncOn ? 'Enabled (redacted summaries)' : 'Off (local only)';
    }
  }
}
