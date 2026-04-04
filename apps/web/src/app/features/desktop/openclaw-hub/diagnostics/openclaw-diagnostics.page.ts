import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OpenClawDesktopService, type OpenClawStatusSnapshot } from '../../../../core/desktop/openclaw-desktop.service';

interface DiagnosticCheck {
  id: string;
  label: string;
  status: 'pass' | 'fail' | 'checking' | 'unknown';
  detail?: string;
  action?: { label: string; handler: () => void };
}

@Component({
  selector: 'app-openclaw-diagnostics',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dg">
      <div class="dg-header">
        <h2 class="dg-title">Health &amp; Diagnostics</h2>
        <button class="btn-primary btn-sm" (click)="runAll()" [disabled]="running">
          {{ running ? 'Checking…' : 'Run All Checks' }}
        </button>
      </div>
      <p class="dg-desc">Verify that OpenClaw, the Local Companion, and Spectyra optimization are working correctly.</p>

      <div class="dg-checks">
        <div class="dg-check" *ngFor="let c of checks" [class.pass]="c.status === 'pass'" [class.fail]="c.status === 'fail'">
          <span class="dg-dot" [class.on]="c.status === 'pass'" [class.off]="c.status === 'fail'"></span>
          <div class="dg-check-body">
            <span class="dg-check-label">{{ c.label }}</span>
            <span class="dg-check-detail" *ngIf="c.detail">{{ c.detail }}</span>
          </div>
          <button class="btn-secondary btn-xs" *ngIf="c.action" (click)="c.action.handler()">
            {{ c.action.label }}
          </button>
        </div>
      </div>

      <div class="dg-section" *ngIf="doctorOutput">
        <h3 class="dg-section-title">OpenClaw Doctor Output</h3>
        <pre class="dg-output">{{ doctorOutput }}</pre>
      </div>

      <div class="dg-section">
        <h3 class="dg-section-title">Repair Actions</h3>
        <div class="dg-action-grid">
          <button class="dg-action-btn" (click)="runDoctor()" [disabled]="doctorRunning">
            <span class="dg-action-icon">🩺</span>
            <span class="dg-action-label">{{ doctorRunning ? 'Running…' : 'Run Doctor' }}</span>
            <span class="dg-action-desc">Run <code>openclaw doctor</code></span>
          </button>
          <button class="dg-action-btn" (click)="openConfig()">
            <span class="dg-action-icon">📁</span>
            <span class="dg-action-label">Open Config</span>
            <span class="dg-action-desc">Open OpenClaw config folder</span>
          </button>
          <button class="dg-action-btn" (click)="openLogs()">
            <span class="dg-action-icon">📄</span>
            <span class="dg-action-label">Open Logs</span>
            <span class="dg-action-desc">Open OpenClaw log directory</span>
          </button>
          <button class="dg-action-btn" (click)="restartCompanion()" [disabled]="restarting">
            <span class="dg-action-icon">🔄</span>
            <span class="dg-action-label">{{ restarting ? 'Restarting…' : 'Restart Companion' }}</span>
            <span class="dg-action-desc">Stop and restart the Local Companion process</span>
          </button>
          <button class="dg-action-btn" (click)="openDataDir()">
            <span class="dg-action-icon">💾</span>
            <span class="dg-action-label">Open Data Dir</span>
            <span class="dg-action-desc">Open Spectyra companion data folder</span>
          </button>
        </div>
      </div>

      <div class="dg-section" *ngIf="lastChecked">
        <span class="dg-last-check">Last checked: {{ lastChecked | date:'medium' }}</span>
      </div>
    </div>
  `,
  styles: [`
    .dg {}
    .dg-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .dg-title { font-size: 14px; font-weight: 600; color: var(--text-primary, #fff); margin: 0; }
    .dg-desc { font-size: 12px; color: var(--text-muted, rgba(255,255,255,0.45)); margin: 0 0 20px; }

    .dg-checks { display: flex; flex-direction: column; gap: 6px; margin-bottom: 28px; }
    .dg-check {
      display: flex; align-items: center; gap: 12px;
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      border-radius: 8px; padding: 12px 16px;
    }
    .dg-check.pass { border-color: rgba(34,197,94,0.2); }
    .dg-check.fail { border-color: rgba(239,68,68,0.2); }
    .dg-dot {
      width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
      background: var(--text-muted, rgba(255,255,255,0.3));
    }
    .dg-dot.on { background: var(--spectyra-green, #22c55e); }
    .dg-dot.off { background: var(--spectyra-red, #ef4444); }
    .dg-check-body { flex: 1; display: flex; flex-direction: column; }
    .dg-check-label { font-size: 13px; font-weight: 500; color: var(--text-primary, #fff); }
    .dg-check-detail { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.45)); margin-top: 2px; }

    .dg-section { margin-bottom: 24px; }
    .dg-section-title { font-size: 13px; font-weight: 600; color: var(--text-primary, #fff); margin: 0 0 10px; }
    .dg-output {
      background: rgba(0,0,0,0.3); padding: 14px; border-radius: 8px;
      font-family: 'DM Mono', monospace; font-size: 12px; color: var(--text-primary, #fff);
      white-space: pre-wrap; max-height: 300px; overflow: auto;
    }

    .dg-action-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; }
    .dg-action-btn {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      border-radius: 10px; padding: 14px 16px; cursor: pointer;
      display: flex; flex-direction: column; gap: 4px; text-align: left;
      transition: border-color 0.15s;
    }
    .dg-action-btn:hover { border-color: var(--spectyra-blue, #5b8def); }
    .dg-action-btn:disabled { opacity: 0.5; cursor: default; }
    .dg-action-icon { font-size: 18px; }
    .dg-action-label { font-size: 12px; font-weight: 600; color: var(--text-primary, #fff); }
    .dg-action-desc { font-size: 10px; color: var(--text-muted, rgba(255,255,255,0.4)); }
    .dg-action-desc code {
      background: rgba(0,0,0,0.2); padding: 1px 4px; border-radius: 3px;
      font-family: 'DM Mono', monospace;
    }

    .btn-sm { font-size: 12px; padding: 6px 14px; }
    .btn-xs { font-size: 11px; padding: 4px 10px; }
    .dg-last-check { font-size: 11px; color: var(--text-muted, rgba(255,255,255,0.35)); }
  `],
})
export class OpenClawDiagnosticsPage implements OnInit {
  private readonly svc = inject(OpenClawDesktopService);

  checks: DiagnosticCheck[] = [];
  running = false;
  doctorOutput: string | null = null;
  doctorRunning = false;
  restarting = false;
  lastChecked: Date | null = null;

  ngOnInit() {
    void this.runAll();
  }

  async runAll() {
    this.running = true;
    this.checks = [
      { id: 'cli', label: 'OpenClaw CLI detected', status: 'checking' },
      { id: 'companion', label: 'Local Companion running', status: 'checking' },
      { id: 'provider', label: 'Provider key configured', status: 'checking' },
      { id: 'models', label: 'Spectyra models visible', status: 'checking' },
      { id: 'dashboard', label: 'OpenClaw dashboard reachable', status: 'checking' },
      { id: 'gateway', label: 'OpenClaw gateway reachable', status: 'checking' },
    ];

    const s = await this.svc.refreshStatus();

    this.updateCheck('cli', s.cliDetected, s.cliDetected ? 'OpenClaw found in PATH' : 'Not found — install OpenClaw first');
    this.updateCheck('companion', s.companionHealthy,
      s.companionHealthy ? `Healthy — mode: ${s.runMode || 'unknown'}` : 'Not responding');
    this.updateCheck('provider', s.providerConfigured,
      s.providerConfigured ? `Provider: ${s.provider || 'configured'}` : 'No provider key set');
    this.updateCheck('models', s.companionHealthy,
      s.companionHealthy ? (s.modelAliases?.join(', ') || 'spectyra/smart, spectyra/fast') : 'Companion offline');
    this.updateCheck('dashboard', s.dashboardReachable,
      s.dashboardReachable ? 'Dashboard accessible' : 'Not reachable (may not be running)');
    this.updateCheck('gateway', s.gatewayReachable,
      s.gatewayReachable ? 'Gateway accessible' : 'Not reachable (local-only is normal)');

    if (!s.companionHealthy) {
      const c = this.checks.find((x) => x.id === 'companion');
      if (c) c.action = { label: 'Restart', handler: () => this.restartCompanion() };
    }

    this.lastChecked = new Date();
    this.running = false;
  }

  async runDoctor() {
    this.doctorRunning = true;
    this.doctorOutput = null;
    const r = await this.svc.runDoctor();
    this.doctorOutput = r.output || '(No output)';
    this.doctorRunning = false;
  }

  async openConfig() {
    await this.svc.openConfig();
  }

  async openLogs() {
    await this.svc.openLogs();
  }

  async openDataDir() {
    if (window.spectyra?.app) {
      await window.spectyra.app.openDataDir();
    }
  }

  async restartCompanion() {
    this.restarting = true;
    await this.svc.restartCompanion();
    await new Promise((r) => setTimeout(r, 3000));
    await this.runAll();
    this.restarting = false;
  }

  private updateCheck(id: string, pass: boolean, detail?: string) {
    const c = this.checks.find((x) => x.id === id);
    if (c) {
      c.status = pass ? 'pass' : 'fail';
      if (detail) c.detail = detail;
    }
  }
}
