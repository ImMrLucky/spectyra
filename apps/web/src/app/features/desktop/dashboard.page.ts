import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { DesktopBridgeService } from '../../core/desktop/desktop-bridge.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../core/agent-companion/trial-license-ui.service';
import { environment } from '../../../environments/environment';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-desktop-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-sub">Local Companion at <span class="mono">{{ companionHost }}</span></p>
      </header>

      <!-- Status -->
      <div class="status-row">
        <div class="status-card" [class.ok]="health?.['status'] === 'ok'">
          <span class="sd-dot" [class.on]="health?.['status'] === 'ok'"></span>
          <span class="sd-label">{{ health?.['status'] === 'ok' ? 'Connected' : 'Offline' }}</span>
        </div>
        <div class="topline-chips" *ngIf="topline">
          <span class="chip opt">{{ topline.optimizationHeadline }}</span>
          <span class="chip trial" *ngIf="topline.trialBadge === 'Trial Active'">Trial · {{ topline.trialDaysLeft }}d</span>
          <span class="chip trial-ended" *ngIf="topline.trialBadge === 'Trial Ended'">Trial ended</span>
        </div>
      </div>

      <!-- Connection details -->
      <div class="detail-grid" *ngIf="health">
        <div class="detail-card">
          <span class="dc-label">Run mode</span>
          <span class="dc-value">{{ health['runMode'] || '—' }}</span>
        </div>
        <div class="detail-card">
          <span class="dc-label">Inference</span>
          <span class="dc-value">{{ health['inferencePath'] || 'direct_provider' }}</span>
        </div>
        <div class="detail-card">
          <span class="dc-label">Telemetry</span>
          <span class="dc-value">{{ health['telemetryMode'] || 'local' }}</span>
        </div>
        <div class="detail-card">
          <span class="dc-label">Billing</span>
          <span class="dc-value">Your provider account</span>
        </div>
      </div>

      <!-- Current session -->
      <div class="session-card" *ngIf="currentSession">
        <h2 class="section-label">CURRENT SESSION</h2>
        <div class="session-metrics">
          <div class="sm-item">
            <span class="sm-label">Steps</span>
            <span class="sm-value">{{ currentSession['totalSteps'] ?? '—' }}</span>
          </div>
          <div class="sm-item">
            <span class="sm-label">Tokens saved</span>
            <span class="sm-value teal">{{ tokenSavedInput(currentSession) | number:'1.0-0' }}</span>
          </div>
          <div class="sm-item">
            <span class="sm-label">Est. savings</span>
            <span class="sm-value teal">\${{ workflowSavingsUsd(currentSession) | number:'1.2-4' }}</span>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div class="actions">
        <a class="btn-primary" routerLink="/desktop/live">Open Live</a>
        <a class="btn-secondary" routerLink="/desktop/openclaw">OpenClaw setup</a>
        <a class="btn-secondary" routerLink="/desktop/runs">Run history</a>
        <button class="btn-secondary" (click)="refresh()">Refresh</button>
      </div>

      <!-- Trust -->
      <div class="trust-card">
        <ul class="trust-list">
          <li>Provider billing stays on your account.</li>
          <li>Inference goes direct to your provider — no Spectyra relay.</li>
          <li>Prompts and responses stay local by default.</li>
        </ul>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 820px;
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
      .mono { font-family: var(--font-mono); color: var(--spectyra-blue-light); }

      .status-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .status-card {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 14px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);

        &.ok { border-color: var(--spectyra-teal-border); }
      }

      .sd-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--dot-offline);

        &.on { background: var(--dot-healthy); animation: pulse 2s ease-in-out infinite; }
      }

      .sd-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .topline-chips {
        display: flex;
        gap: 6px;
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

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }

      .detail-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        padding: 12px 14px;
      }

      .dc-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        display: block;
        margin-bottom: 4px;
      }

      .dc-value {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--spectyra-blue-light);
      }

      .session-card {
        background: var(--bg-card);
        border: 1px solid var(--spectyra-teal-border);
        border-radius: var(--radius-card);
        padding: 16px;
        margin-bottom: 16px;
      }

      .section-label {
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin: 0 0 12px;
      }

      .session-metrics {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 12px;
      }

      .sm-item {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .sm-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
      }

      .sm-value {
        font-family: var(--font-mono);
        font-size: 18px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .sm-value.teal { color: #5DCAA5; }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 20px;
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

      .btn-secondary {
        display: inline-flex;
        align-items: center;
        padding: 8px 14px;
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-bright);
        border-radius: 6px;
        font-family: var(--font-body);
        font-size: 12px;
        cursor: pointer;
        text-decoration: none;
        transition: border-color 0.15s ease;

        &:hover { border-color: var(--spectyra-blue); color: var(--text-primary); }
      }

      .trust-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        padding: 14px 16px;
      }

      .trust-list {
        margin: 0;
        padding-left: 1.1rem;
        line-height: 1.7;
        font-size: 12px;
        color: var(--text-secondary);
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
    `,
  ],
})
export class DesktopDashboardPage implements OnInit, OnDestroy {
  companionHost = environment.companionBaseUrl;
  health: Record<string, unknown> | null = null;
  currentSession: Record<string, unknown> | null = null;
  topline: LiveProductTopline | null = null;
  private poll?: Subscription;

  tokenSavedInput(cs: Record<string, unknown>): number {
    const b = Number(cs['totalInputTokensBefore'] ?? 0);
    const a = Number(cs['totalInputTokensAfter'] ?? 0);
    return Math.max(0, b - a);
  }

  workflowSavingsUsd(cs: Record<string, unknown>): number {
    return Number(cs['estimatedWorkflowSavings'] ?? 0);
  }

  constructor(
    private desktop: DesktopBridgeService,
    private trialUi: TrialLicenseUiService,
  ) {}

  ngOnInit() {
    void this.refresh();
    this.poll = interval(8000).subscribe(() => void this.refresh());
  }

  ngOnDestroy() {
    this.poll?.unsubscribe();
  }

  async refresh() {
    try {
      const h = await fetch(`${this.companionHost}/health`).then((r) => (r.ok ? r.json() : null));
      this.health = h;
      this.topline = this.trialUi.computeTopline(h);
    } catch {
      this.health = null;
    }
    try {
      const s = await fetch(`${this.companionHost}/v1/analytics/current-session`).then((r) =>
        r.ok ? r.json() : null,
      );
      this.currentSession = s && typeof s === 'object' && s !== null && 'sessionId' in s ? s : null;
    } catch {
      this.currentSession = null;
    }
  }
}
