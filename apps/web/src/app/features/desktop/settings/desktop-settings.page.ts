import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';

@Component({
  selector: 'app-desktop-settings',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Settings</h1>
        <p class="page-sub">Desktop preferences and companion configuration.</p>
      </header>

      <!-- Companion status -->
      <div class="status-card" [class.ok]="companionOk">
        <div class="sc-row">
          <span class="sc-dot" [class.on]="companionOk"></span>
          <span class="sc-label">
            Companion {{ companionOk ? 'running' : 'offline' }}
          </span>
        </div>
        <div class="sc-details" *ngIf="companionOk">
          <span class="sc-detail">Mode: <strong>{{ runMode }}</strong></span>
          <span class="sc-detail">Telemetry: <strong>{{ telemetry }}</strong></span>
          <span class="sc-detail">Snapshots: <strong>{{ snapshots }}</strong></span>
        </div>
      </div>

      <!-- Settings cards -->
      <div class="settings-grid">
        <div class="settings-card">
          <h3 class="sc-title">Provider & companion</h3>
          <p class="sc-desc">API keys, port, run mode, and telemetry are configured during onboarding.</p>
          <a class="btn-secondary" routerLink="/desktop/onboarding">Configure provider</a>
        </div>

        <div class="settings-card">
          <h3 class="sc-title">Integrations</h3>
          <p class="sc-desc">Connect OpenClaw, Claude, OpenAI, or custom agents.</p>
          <div class="sc-links">
            <a class="btn-link" routerLink="/desktop/agent-companion">Agent Companion wizard</a>
          </div>
        </div>

        <div class="settings-card" *ngIf="topline">
          <h3 class="sc-title">License</h3>
          <p class="sc-desc mono-val">{{ topline.trialBadge || 'No trial' }}</p>
          <p class="sc-desc" *ngIf="topline.trialDaysLeft !== null">
            {{ topline.trialDaysLeft }} day{{ topline.trialDaysLeft !== 1 ? 's' : '' }} remaining
          </p>
          <p class="sc-desc">{{ topline.optimizationHeadline }}</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 780px;
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

      /* ── Status card ── */
      .status-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 14px 16px;
        margin-bottom: 16px;

        &.ok { border-color: var(--spectyra-teal-border); }
      }

      .sc-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .sc-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--dot-offline);

        &.on {
          background: var(--dot-healthy);
          animation: pulse 2s ease-in-out infinite;
        }
      }

      .sc-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .sc-details {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        margin-top: 10px;
        padding-left: 15px;
      }

      .sc-detail {
        font-size: 12px;
        color: var(--text-secondary);

        strong {
          font-family: var(--font-mono);
          color: var(--spectyra-blue-light);
        }
      }

      /* ── Settings grid ── */
      .settings-grid {
        display: grid;
        gap: 12px;
      }

      .settings-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 18px;
      }

      .sc-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 8px;
      }

      .sc-desc {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
        margin: 0 0 12px;
      }

      .sc-desc.mono-val {
        font-family: var(--font-mono);
        color: var(--spectyra-blue-light);
      }

      .sc-links {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .btn-secondary {
        display: inline-flex;
        align-items: center;
        padding: 7px 14px;
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-bright);
        border-radius: 6px;
        font-family: var(--font-body);
        font-size: 12px;
        cursor: pointer;
        text-decoration: none;
        transition: border-color 0.15s ease, color 0.15s ease;

        &:hover { border-color: var(--spectyra-blue); color: var(--text-primary); }
      }

      .btn-link {
        color: var(--spectyra-blue);
        font-size: 12px;
        text-decoration: none;

        &:hover { text-decoration: underline; }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
    `,
  ],
})
export class DesktopSettingsPage implements OnInit {
  topline: LiveProductTopline | null = null;
  companionOk = false;
  runMode = '—';
  telemetry = '—';
  snapshots = '—';

  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
  ) {}

  async ngOnInit() {
    const h = await this.companion.fetchHealth();
    this.topline = this.trialUi.computeTopline(h);
    this.companionOk = h?.['status'] === 'ok';
    this.runMode = String(h?.['runMode'] ?? '—');
    this.telemetry = String(h?.['telemetryMode'] ?? '—');
    this.snapshots = String(h?.['promptSnapshots'] ?? '—');
  }
}
