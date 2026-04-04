import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';

@Component({
  selector: 'app-desktop-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
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
        <div class="settings-card" *ngIf="isDesktop">
          <h3 class="sc-title">AI provider & OpenClaw</h3>
          <p class="sc-desc">Add your API key and copy the connection block for OpenClaw — all on one short page.</p>
          <a class="btn-secondary" routerLink="/desktop/openclaw/setup">OpenClaw setup</a>

          <div class="provider-panel">
            <p class="sc-desc">
              <strong>Active provider</strong> (what the companion uses for all clients right now):
              <span class="path-code">{{ activeProviderLabel }}</span>
            </p>
            <p class="sc-desc" *ngIf="savedKeysLine">
              Keys saved in Spectyra: <span class="path-code">{{ savedKeysLine }}</span>
            </p>
            <p class="sc-desc subtle">
              Per request, clients can use <code>spectyra/fast</code> for cheaper runs or <code>spectyra/quality</code> for heavier work
              — you can remap those names below. One active provider applies to every flow until you switch it here.
            </p>

            <div class="sc-row-controls">
              <select class="sc-select" [(ngModel)]="pendingProvider" [disabled]="switchBusy">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="groq">Groq</option>
              </select>
              <button
                type="button"
                class="btn-secondary"
                [disabled]="switchBusy || pendingProvider === activeProvider"
                (click)="applyActiveProvider()"
              >
                {{ switchBusy ? 'Applying…' : 'Use this provider' }}
              </button>
            </div>
            <p class="sc-desc warn" *ngIf="switchMsg">{{ switchMsg }}</p>

            <details class="alias-details">
              <summary class="alias-sum">Model names for spectyra/* aliases</summary>
              <p class="sc-desc subtle">
                OpenClaw and the SDK send stable ids (<code>spectyra/smart</code>, <code>spectyra/fast</code>, <code>spectyra/quality</code>);
                map them to real model ids on your active vendor.
              </p>
              <label class="sc-label">spectyra/smart</label>
              <input class="sc-input" [(ngModel)]="aliasSmart" [disabled]="aliasBusy" autocomplete="off" />
              <label class="sc-label">spectyra/fast</label>
              <input class="sc-input" [(ngModel)]="aliasFast" [disabled]="aliasBusy" autocomplete="off" />
              <label class="sc-label">spectyra/quality</label>
              <input class="sc-input" [(ngModel)]="aliasQuality" [disabled]="aliasBusy" autocomplete="off" />
              <button type="button" class="btn-secondary alias-save" [disabled]="aliasBusy" (click)="saveAliasModels()">
                {{ aliasBusy ? 'Saving…' : 'Save mappings' }}
              </button>
              <p class="sc-desc warn" *ngIf="aliasMsg">{{ aliasMsg }}</p>
            </details>
          </div>
          <p class="sc-desc path-hint" *ngIf="configDir">
            Keys live in <span class="path-code">{{ configDir }}</span> (local only; not sent to Spectyra).
          </p>
          <button
            type="button"
            class="btn-danger"
            [disabled]="clearKeysBusy"
            (click)="removeProviderKeys()"
          >
            {{ clearKeysBusy ? 'Removing…' : 'Remove saved API keys' }}
          </button>
          <p class="sc-desc" *ngIf="clearKeysMsg">{{ clearKeysMsg }}</p>
        </div>

        <div class="settings-card" *ngIf="!isDesktop">
          <h3 class="sc-title">AI provider & OpenClaw</h3>
          <p class="sc-desc">Open the Spectyra Desktop app to manage local API keys and OpenClaw.</p>
        </div>

        <div class="settings-card">
          <h3 class="sc-title">More setups</h3>
          <p class="sc-desc">Other runtimes (Claude, SDK, logs) and the full step-by-step wizard.</p>
          <div class="sc-links">
            <a class="btn-link" routerLink="/desktop/agent-companion">Setup wizard</a>
            <a class="btn-link" routerLink="/desktop/onboarding">First-run choices</a>
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

      .path-hint {
        margin-top: 14px;
      }

      .path-code {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--spectyra-blue-light);
        word-break: break-all;
      }

      .provider-panel {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--border);
      }

      .sc-desc.subtle {
        font-size: 11px;
        color: var(--text-muted, var(--text-secondary));
      }

      .sc-desc.subtle code {
        font-family: var(--font-mono);
        font-size: 10px;
      }

      .sc-desc.warn {
        color: #f87171;
      }

      .sc-row-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-top: 12px;
      }

      .sc-select {
        min-width: 160px;
        padding: 7px 10px;
        border-radius: 6px;
        border: 1px solid var(--border-bright);
        background: var(--bg-input, rgba(0, 0, 0, 0.2));
        color: var(--text-primary);
        font-size: 13px;
        font-family: var(--font-body);
      }

      .sc-label {
        display: block;
        font-size: 11px;
        color: var(--text-secondary);
        margin: 10px 0 4px;
      }

      .sc-input {
        width: 100%;
        box-sizing: border-box;
        padding: 7px 10px;
        border-radius: 6px;
        border: 1px solid var(--border-bright);
        background: var(--bg-input, rgba(0, 0, 0, 0.2));
        color: var(--text-primary);
        font-family: var(--font-mono);
        font-size: 12px;
      }

      .alias-details {
        margin-top: 16px;
        font-size: 12px;
        color: var(--text-secondary);
      }

      .alias-sum {
        cursor: pointer;
        font-weight: 500;
        color: var(--text-primary);
      }

      .alias-save {
        margin-top: 12px;
      }

      .btn-danger {
        display: inline-flex;
        align-items: center;
        margin-top: 10px;
        padding: 7px 14px;
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid rgba(220, 90, 90, 0.45);
        border-radius: 6px;
        font-family: var(--font-body);
        font-size: 12px;
        cursor: pointer;
        transition: border-color 0.15s ease, color 0.15s ease;

        &:hover:not(:disabled) {
          border-color: rgba(240, 120, 120, 0.7);
          color: var(--text-primary);
        }

        &:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }
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
  configDir: string | null = null;
  clearKeysBusy = false;
  clearKeysMsg: string | null = null;

  isDesktop = false;
  activeProvider = 'openai';
  pendingProvider = 'openai';
  savedKeysLine = '';
  switchBusy = false;
  switchMsg: string | null = null;
  aliasSmart = '';
  aliasFast = '';
  aliasQuality = '';
  aliasBusy = false;
  aliasMsg: string | null = null;

  constructor(
    private companion: CompanionAnalyticsService,
    private trialUi: TrialLicenseUiService,
    private desktopBridge: DesktopBridgeService,
  ) {}

  get activeProviderLabel(): string {
    switch (this.activeProvider) {
      case 'openai':
        return 'OpenAI';
      case 'anthropic':
        return 'Anthropic';
      case 'groq':
        return 'Groq';
      default:
        return this.activeProvider;
    }
  }

  async ngOnInit() {
    this.isDesktop = this.desktopBridge.isElectronRenderer;
    const [h, info] = await Promise.all([this.companion.fetchHealth(), this.desktopBridge.getAppInfo()]);
    this.topline = this.trialUi.computeTopline(h);
    this.companionOk = h?.['status'] === 'ok';
    this.runMode = String(h?.['runMode'] ?? '—');
    this.telemetry = String(h?.['telemetryMode'] ?? '—');
    this.snapshots = String(h?.['promptSnapshots'] ?? '—');
    const dir = info?.['configDir'];
    this.configDir = typeof dir === 'string' ? dir : null;
    await this.loadProviderPanel();
  }

  private async loadProviderPanel(): Promise<void> {
    if (!this.isDesktop) return;
    const cfg = await this.desktopBridge.getConfig();
    if (!cfg) return;
    const p = cfg['provider'];
    if (typeof p === 'string' && ['openai', 'anthropic', 'groq'].includes(p)) {
      this.activeProvider = p;
      this.pendingProvider = p;
    }
    const keys = cfg['providerKeys'] as Record<string, string> | undefined;
    const names = keys ? Object.keys(keys).filter((k) => keys[k]?.trim()) : [];
    this.savedKeysLine = names.length ? names.join(', ') : '';
    this.aliasSmart = String(cfg['aliasSmartModel'] ?? '');
    this.aliasFast = String(cfg['aliasFastModel'] ?? '');
    this.aliasQuality = String(cfg['aliasQualityModel'] ?? '');
  }

  async applyActiveProvider(): Promise<void> {
    if (!this.isDesktop || this.pendingProvider === this.activeProvider) return;
    this.switchBusy = true;
    this.switchMsg = null;
    try {
      const r = await this.desktopBridge.setActiveProvider(this.pendingProvider);
      if (r.ok) {
        this.switchMsg = null;
        await this.loadProviderPanel();
        const h = await this.companion.fetchHealth();
        this.companionOk = h?.['status'] === 'ok';
        this.runMode = String(h?.['runMode'] ?? '—');
      } else {
        this.switchMsg = r.error;
      }
    } finally {
      this.switchBusy = false;
    }
  }

  async saveAliasModels(): Promise<void> {
    if (!this.isDesktop) return;
    const s = this.aliasSmart.trim();
    const f = this.aliasFast.trim();
    const q = this.aliasQuality.trim();
    if (!s || !f || !q) {
      this.aliasMsg = 'Fill in all three model ids.';
      return;
    }
    this.aliasBusy = true;
    this.aliasMsg = null;
    try {
      const ok = await this.desktopBridge.saveConfig({
        aliasSmartModel: s,
        aliasFastModel: f,
        aliasQualityModel: q,
      });
      this.aliasMsg = ok ? 'Saved. Companion restarted.' : 'Save failed.';
      if (ok) {
        const h = await this.companion.fetchHealth();
        this.companionOk = h?.['status'] === 'ok';
      }
    } finally {
      this.aliasBusy = false;
    }
  }

  async removeProviderKeys(): Promise<void> {
    if (
      !confirm(
        'Remove all API keys stored by Spectyra on this Mac? Setup will ask for a key again. ' +
          'Environment variables such as OPENAI_API_KEY are not changed.',
      )
    ) {
      return;
    }
    this.clearKeysBusy = true;
    this.clearKeysMsg = null;
    try {
      const ok = await this.desktopBridge.clearProviderKeys();
      this.clearKeysMsg = ok
        ? 'Saved keys were removed and the companion was restarted.'
        : 'Could not clear keys. Quit Spectyra, delete ~/.spectyra/desktop/config.json (or the providerKeys section), then reopen.';
    } finally {
      this.clearKeysBusy = false;
    }
    const h = await this.companion.fetchHealth();
    this.companionOk = h?.['status'] === 'ok';
    this.runMode = String(h?.['runMode'] ?? '—');
    this.telemetry = String(h?.['telemetryMode'] ?? '—');
    this.snapshots = String(h?.['promptSnapshots'] ?? '—');
    await this.loadProviderPanel();
  }
}
