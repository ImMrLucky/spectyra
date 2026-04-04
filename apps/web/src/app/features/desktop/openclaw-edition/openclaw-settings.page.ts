import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import { OpenClawDesktopService, type OpenClawStatusSnapshot } from '../../../core/desktop/openclaw-desktop.service';

@Component({
  selector: 'app-openclaw-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Settings</h1>
        <p class="page-sub">Provider configuration, model aliases, and diagnostics.</p>
      </header>

      <!-- ── Provider card ── -->
      <section class="card">
        <h2 class="card-title">AI Provider</h2>
        <p class="card-desc">
          The companion uses <strong>{{ activeProviderLabel }}</strong> for all clients.
          {{ savedKeysLine ? 'Keys saved: ' + savedKeysLine + '.' : '' }}
        </p>

        <div class="row-controls">
          <select class="ctl-select" [(ngModel)]="pendingProvider" [disabled]="switchBusy">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
          </select>
          <button
            class="btn sec"
            [disabled]="switchBusy || pendingProvider === activeProvider"
            (click)="switchProvider()"
          >
            {{ switchBusy ? 'Switching…' : 'Use this provider' }}
          </button>
        </div>
        <p class="card-warn" *ngIf="switchMsg">{{ switchMsg }}</p>

        <div class="key-actions">
          <a class="btn sec" routerLink="/desktop/setup">Change or add API key</a>
          <button class="btn danger" [disabled]="clearBusy" (click)="clearKeys()">
            {{ clearBusy ? 'Removing…' : 'Remove all saved keys' }}
          </button>
        </div>
        <p class="card-warn" *ngIf="clearMsg">{{ clearMsg }}</p>
        <p class="card-hint" *ngIf="configDir">
          Keys stored in <span class="mono">{{ configDir }}</span> — local only, never sent to Spectyra.
        </p>
      </section>

      <!-- ── Model aliases ── -->
      <section class="card">
        <h2 class="card-title">Model Aliases</h2>
        <p class="card-desc">
          Map <code>spectyra/smart</code>, <code>spectyra/fast</code>, and <code>spectyra/quality</code>
          to real model ids. Clients like OpenClaw use these stable names; Spectyra resolves them to
          your provider's actual models. Use <code>fast</code> for cheaper tasks and <code>quality</code>
          for important work.
        </p>
        <div class="alias-fields">
          <label class="alias-label">spectyra/smart</label>
          <input class="alias-input" [(ngModel)]="aliasSmart" [disabled]="aliasBusy" autocomplete="off" />
          <label class="alias-label">spectyra/fast</label>
          <input class="alias-input" [(ngModel)]="aliasFast" [disabled]="aliasBusy" autocomplete="off" />
          <label class="alias-label">spectyra/quality</label>
          <input class="alias-input" [(ngModel)]="aliasQuality" [disabled]="aliasBusy" autocomplete="off" />
        </div>
        <button class="btn sec" [disabled]="aliasBusy" (click)="saveAliases()">
          {{ aliasBusy ? 'Saving…' : 'Save mappings' }}
        </button>
        <p class="card-warn" *ngIf="aliasMsg">{{ aliasMsg }}</p>
      </section>

      <!-- ── Diagnostics ── -->
      <section class="card">
        <div class="card-head-row">
          <h2 class="card-title">Diagnostics</h2>
          <button class="btn sec btn-sm" (click)="runDiag()" [disabled]="diagBusy">
            {{ diagBusy ? 'Checking…' : 'Run All Checks' }}
          </button>
        </div>

        <div class="diag-list">
          <div
            class="diag-row"
            *ngFor="let c of diagChecks"
            [class.pass]="c.ok === true"
            [class.fail]="c.ok === false"
          >
            <span class="diag-dot" [class.on]="c.ok === true" [class.off]="c.ok === false"></span>
            <div class="diag-body">
              <span class="diag-label">{{ c.label }}</span>
              <span class="diag-detail" *ngIf="c.detail">{{ c.detail }}</span>
            </div>
          </div>
        </div>

        <div class="repair-grid">
          <button class="repair-btn" (click)="runDoctor()" [disabled]="doctorBusy">
            {{ doctorBusy ? 'Running…' : 'Run Doctor' }}
          </button>
          <button class="repair-btn" (click)="openConfig()">Open Config</button>
          <button class="repair-btn" (click)="openLogs()">Open Logs</button>
          <button class="repair-btn" (click)="restartCompanion()" [disabled]="restarting">
            {{ restarting ? 'Restarting…' : 'Restart Companion' }}
          </button>
          <button class="repair-btn" (click)="openDataDir()">Open Data Folder</button>
        </div>

        <pre class="doctor-output" *ngIf="doctorOutput">{{ doctorOutput }}</pre>
      </section>

      <!-- ── License ── -->
      <section class="card" *ngIf="topline">
        <h2 class="card-title">License</h2>
        <p class="card-desc mono">{{ topline.trialBadge || 'No trial' }}</p>
        <p class="card-desc" *ngIf="topline.trialDaysLeft !== null">
          {{ topline.trialDaysLeft }} day{{ topline.trialDaysLeft !== 1 ? 's' : '' }} remaining
        </p>
        <p class="card-desc">{{ topline.optimizationHeadline }}</p>
      </section>
    </div>
  `,
  styles: [`
    .page {
      max-width: 680px;
      margin: 0 auto;
      padding: 28px 20px 48px;
      font-family: 'DM Sans', sans-serif;
    }
    .page-header { margin-bottom: 24px; }
    .page-title {
      font-family: 'Source Sans Pro', 'DM Sans', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary, #e8f1fb);
      margin: 0 0 6px;
    }
    .page-sub {
      font-size: 13px;
      color: var(--text-secondary, #7a9fc0);
      margin: 0;
    }

    .card {
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 12px;
      padding: 20px 22px;
      margin-bottom: 16px;
    }
    .card-head-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary, #e8f1fb);
      margin: 0 0 8px;
    }
    .card-head-row .card-title { margin: 0; }
    .card-desc {
      font-size: 12px;
      color: var(--text-secondary, #7a9fc0);
      line-height: 1.5;
      margin: 0 0 12px;
    }
    .card-desc code {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      background: rgba(0,0,0,0.2);
      padding: 1px 4px;
      border-radius: 3px;
    }
    .card-desc.mono {
      font-family: 'DM Mono', monospace;
      color: var(--spectyra-blue-light, #85B7EB);
    }
    .card-warn { color: #ef4444; font-size: 12px; margin: 8px 0 0; }
    .card-hint { font-size: 11px; color: var(--text-muted, #3d5a78); margin: 12px 0 0; }
    .mono {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      color: var(--spectyra-blue-light, #85B7EB);
      word-break: break-all;
    }

    .row-controls {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 12px;
    }
    .ctl-select {
      min-width: 160px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border-bright, rgba(55,138,221,0.25));
      background: var(--bg-elevated, #162236);
      color: var(--text-primary, #e8f1fb);
      font-size: 13px;
      font-family: 'DM Sans', sans-serif;
    }

    .key-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }

    .alias-fields { margin-bottom: 14px; }
    .alias-label {
      display: block;
      font-size: 11px;
      color: var(--text-secondary, #7a9fc0);
      margin: 10px 0 4px;
    }
    .alias-input {
      width: 100%;
      box-sizing: border-box;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--border-bright, rgba(55,138,221,0.25));
      background: var(--bg-elevated, #162236);
      color: var(--text-primary, #e8f1fb);
      font-family: 'DM Mono', monospace;
      font-size: 12px;
      outline: none;
    }
    .alias-input:focus { border-color: var(--spectyra-blue, #378ADD); }

    /* ── Buttons ── */
    .btn {
      padding: 8px 16px;
      border-radius: 8px;
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      transition: background 0.15s, border-color 0.15s, opacity 0.15s;
    }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn.sec {
      background: transparent;
      color: var(--text-secondary, #7a9fc0);
      border: 1px solid var(--border-bright, rgba(55,138,221,0.25));
    }
    .btn.sec:hover:not(:disabled) {
      border-color: var(--spectyra-blue, #378ADD);
      color: var(--text-primary, #e8f1fb);
    }
    .btn.danger {
      background: transparent;
      color: var(--text-secondary, #7a9fc0);
      border: 1px solid rgba(220,90,90,0.4);
    }
    .btn.danger:hover:not(:disabled) {
      border-color: rgba(240,120,120,0.7);
      color: var(--text-primary, #e8f1fb);
    }
    .btn-sm { font-size: 11px; padding: 5px 12px; }

    /* ── Diagnostics ── */
    .diag-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 16px;
    }
    .diag-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      background: rgba(0,0,0,0.15);
      border: 1px solid transparent;
    }
    .diag-row.pass { border-color: rgba(29,158,117,0.2); }
    .diag-row.fail { border-color: rgba(239,68,68,0.2); }
    .diag-dot {
      width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
      background: var(--text-muted, #3d5a78);
    }
    .diag-dot.on { background: var(--spectyra-teal, #1D9E75); }
    .diag-dot.off { background: #ef4444; }
    .diag-body { flex: 1; }
    .diag-label { font-size: 13px; font-weight: 500; color: var(--text-primary, #e8f1fb); display: block; }
    .diag-detail { font-size: 11px; color: var(--text-muted, #3d5a78); display: block; margin-top: 2px; }

    .repair-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    .repair-btn {
      padding: 7px 14px;
      border-radius: 8px;
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      background: transparent;
      color: var(--text-secondary, #7a9fc0);
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .repair-btn:hover:not(:disabled) {
      border-color: var(--spectyra-blue, #378ADD);
      color: var(--text-primary, #e8f1fb);
    }
    .repair-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .doctor-output {
      background: rgba(0,0,0,0.3);
      padding: 14px;
      border-radius: 8px;
      font-family: 'DM Mono', monospace;
      font-size: 12px;
      color: var(--text-primary, #e8f1fb);
      white-space: pre-wrap;
      max-height: 260px;
      overflow: auto;
      margin-top: 10px;
    }
  `],
})
export class OpenClawSettingsPage implements OnInit {
  private readonly desktop = inject(DesktopBridgeService);
  private readonly analytics = inject(CompanionAnalyticsService);
  private readonly trialUi = inject(TrialLicenseUiService);
  private readonly oc = inject(OpenClawDesktopService);

  topline: LiveProductTopline | null = null;
  configDir: string | null = null;

  activeProvider = 'openai';
  pendingProvider = 'openai';
  savedKeysLine = '';
  switchBusy = false;
  switchMsg: string | null = null;

  clearBusy = false;
  clearMsg: string | null = null;

  aliasSmart = '';
  aliasFast = '';
  aliasQuality = '';
  aliasBusy = false;
  aliasMsg: string | null = null;

  diagChecks: Array<{ label: string; ok: boolean | null; detail?: string }> = [];
  diagBusy = false;

  doctorBusy = false;
  doctorOutput: string | null = null;
  restarting = false;

  get activeProviderLabel(): string {
    switch (this.activeProvider) {
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic';
      case 'groq': return 'Groq';
      default: return this.activeProvider;
    }
  }

  async ngOnInit(): Promise<void> {
    const [h, info] = await Promise.all([
      this.analytics.fetchHealth(),
      this.desktop.getAppInfo(),
    ]);
    this.topline = this.trialUi.computeTopline(h);
    this.configDir = typeof info?.['configDir'] === 'string' ? info['configDir'] as string : null;
    await this.loadProviderState();
    void this.runDiag();
  }

  private async loadProviderState(): Promise<void> {
    const cfg = await this.desktop.getConfig();
    if (!cfg) return;
    const p = cfg['provider'];
    if (typeof p === 'string' && ['openai', 'anthropic', 'groq'].includes(p)) {
      this.activeProvider = p;
      this.pendingProvider = p;
    }
    const keys = cfg['providerKeys'] as Record<string, string> | undefined;
    this.savedKeysLine = keys
      ? Object.keys(keys).filter((k) => keys[k]?.trim()).join(', ')
      : '';
    this.aliasSmart = String(cfg['aliasSmartModel'] ?? '');
    this.aliasFast = String(cfg['aliasFastModel'] ?? '');
    this.aliasQuality = String(cfg['aliasQualityModel'] ?? '');
  }

  async switchProvider(): Promise<void> {
    if (this.pendingProvider === this.activeProvider) return;
    this.switchBusy = true;
    this.switchMsg = null;
    try {
      const r = await this.desktop.setActiveProvider(this.pendingProvider);
      if (r.ok) {
        await this.loadProviderState();
      } else {
        this.switchMsg = r.error;
      }
    } finally {
      this.switchBusy = false;
    }
  }

  async clearKeys(): Promise<void> {
    if (!confirm('Remove all API keys saved by Spectyra? You will need to enter one again.')) return;
    this.clearBusy = true;
    this.clearMsg = null;
    try {
      const ok = await this.desktop.clearProviderKeys();
      this.clearMsg = ok
        ? 'Keys removed. Companion restarted.'
        : 'Could not clear. Delete ~/.spectyra/desktop/config.json manually.';
      if (ok) await this.loadProviderState();
    } finally {
      this.clearBusy = false;
    }
  }

  async saveAliases(): Promise<void> {
    const s = this.aliasSmart.trim();
    const f = this.aliasFast.trim();
    const q = this.aliasQuality.trim();
    if (!s || !f || !q) {
      this.aliasMsg = 'All three model ids are required.';
      return;
    }
    this.aliasBusy = true;
    this.aliasMsg = null;
    try {
      const ok = await this.desktop.saveConfig({
        aliasSmartModel: s,
        aliasFastModel: f,
        aliasQualityModel: q,
      });
      this.aliasMsg = ok ? 'Saved. Companion restarted.' : 'Save failed.';
    } finally {
      this.aliasBusy = false;
    }
  }

  async runDiag(): Promise<void> {
    this.diagBusy = true;
    this.diagChecks = [
      { label: 'OpenClaw CLI', ok: null },
      { label: 'Companion', ok: null },
      { label: 'Provider key', ok: null },
      { label: 'Model aliases', ok: null },
    ];
    const s = await this.oc.refreshStatus();

    this.diagChecks[0] = {
      label: 'OpenClaw CLI',
      ok: s.cliDetected || s.openclawDetected,
      detail: s.cliDetected ? 'Found in PATH' : 'Not found — install OpenClaw first',
    };
    this.diagChecks[1] = {
      label: 'Companion',
      ok: s.companionHealthy,
      detail: s.companionHealthy ? `Healthy — mode: ${s.runMode || 'on'}` : 'Not responding',
    };
    this.diagChecks[2] = {
      label: 'Provider key',
      ok: s.providerConfigured,
      detail: s.providerConfigured ? `Provider: ${s.provider || 'configured'}` : 'No key set',
    };
    this.diagChecks[3] = {
      label: 'Model aliases',
      ok: s.companionHealthy,
      detail: s.companionHealthy
        ? (s.modelAliases?.join(', ') || 'spectyra/smart, spectyra/fast')
        : 'Companion offline',
    };
    this.diagBusy = false;
  }

  async runDoctor(): Promise<void> {
    this.doctorBusy = true;
    this.doctorOutput = null;
    const r = await this.oc.runDoctor();
    this.doctorOutput = r.output || '(No output)';
    this.doctorBusy = false;
  }

  async openConfig(): Promise<void> { await this.oc.openConfig(); }
  async openLogs(): Promise<void> { await this.oc.openLogs(); }
  async openDataDir(): Promise<void> { await window.spectyra?.app?.openDataDir(); }

  async restartCompanion(): Promise<void> {
    this.restarting = true;
    await this.oc.restartCompanion();
    await new Promise((r) => setTimeout(r, 3000));
    await this.runDiag();
    this.restarting = false;
  }
}
