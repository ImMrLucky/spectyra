import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { OpenClawDesktopService, type OpenClawStatusSnapshot } from '../../../../core/desktop/openclaw-desktop.service';

@Component({
  selector: 'app-openclaw-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  template: `
    <div class="ov">
      <div class="ov-status-grid">
        <div class="ov-card" [class.ok]="s?.openclawDetected" [class.warn]="!s?.openclawDetected">
          <span class="ov-dot" [class.on]="s?.openclawDetected"></span>
          <span class="ov-label">OpenClaw</span>
          <span class="ov-value">{{ s?.openclawDetected ? 'Detected' : 'Not found' }}</span>
        </div>
        <div class="ov-card" [class.ok]="s?.companionHealthy" [class.warn]="!s?.companionHealthy">
          <span class="ov-dot" [class.on]="s?.companionHealthy"></span>
          <span class="ov-label">Companion</span>
          <span class="ov-value">{{ s?.companionHealthy ? 'Running' : 'Offline' }}</span>
        </div>
        <div class="ov-card" [class.ok]="s?.providerConfigured" [class.warn]="!s?.providerConfigured">
          <span class="ov-dot" [class.on]="s?.providerConfigured"></span>
          <span class="ov-label">Provider</span>
          <span class="ov-value">{{ s?.providerConfigured ? (s?.provider || 'Connected') : 'Not set' }}</span>
        </div>
        <div class="ov-card" [class.ok]="s?.runMode === 'on'" [class.observe]="s?.runMode === 'observe'">
          <span class="ov-dot" [class.on]="s?.runMode === 'on'" [class.observe]="s?.runMode === 'observe'"></span>
          <span class="ov-label">Optimization</span>
          <span class="ov-value">{{ (s?.runMode || 'unknown') | uppercase }}</span>
        </div>
      </div>

      <div class="ov-actions">
        <h2 class="ov-section-title">Quick Actions</h2>
        <div class="ov-action-grid">
          <a class="ov-action" routerLink="../setup">
            <mat-icon class="ov-action-icon">tune</mat-icon>
            <span class="ov-action-label">Setup OpenClaw</span>
          </a>
          <a class="ov-action" routerLink="../skills">
            <mat-icon class="ov-action-icon">extension</mat-icon>
            <span class="ov-action-label">Install Skills</span>
          </a>
          <a class="ov-action" routerLink="../assistants">
            <mat-icon class="ov-action-icon">manage_accounts</mat-icon>
            <span class="ov-action-label">Assistant Profiles</span>
          </a>
          <a class="ov-action" routerLink="../tasks">
            <mat-icon class="ov-action-icon">task_alt</mat-icon>
            <span class="ov-action-label">Create Task</span>
          </a>
          <a class="ov-action" routerLink="../diagnostics">
            <mat-icon class="ov-action-icon">troubleshoot</mat-icon>
            <span class="ov-action-label">Run Health Check</span>
          </a>
          <a class="ov-action" routerLink="/desktop/live">
            <mat-icon class="ov-action-icon">show_chart</mat-icon>
            <span class="ov-action-label">Open Live</span>
          </a>
        </div>
      </div>

      <div class="ov-next" *ngIf="nextAction">
        <h2 class="ov-section-title">Next Step</h2>
        <div class="ov-next-card">
          <p class="ov-next-text">{{ nextAction.message }}</p>
          <a class="btn-primary" [routerLink]="nextAction.link">{{ nextAction.label }}</a>
        </div>
      </div>

      <div class="ov-footer">
        <button class="btn-secondary btn-sm" (click)="refresh()" [disabled]="svc.loading()">
          {{ svc.loading() ? 'Checking…' : 'Refresh status' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .ov { }

    .ov-status-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 28px;
    }
    .ov-card {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      border-radius: 10px;
      padding: 16px 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ov-card.ok { border-color: rgba(34,197,94,0.25); }
    .ov-card.warn { border-color: rgba(239,68,68,0.2); }
    .ov-card.observe { border-color: rgba(234,179,8,0.25); }
    .ov-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--spectyra-red, #ef4444);
      display: inline-block;
    }
    .ov-dot.on { background: var(--spectyra-green, #22c55e); }
    .ov-dot.observe { background: #eab308; }
    .ov-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, rgba(255,255,255,0.4)); }
    .ov-value { font-size: 15px; font-weight: 600; color: var(--text-primary, #fff); }

    .ov-section-title {
      font-size: 14px; font-weight: 600;
      color: var(--text-primary, #fff);
      margin: 0 0 12px;
    }

    .ov-action-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 10px;
      margin-bottom: 28px;
    }
    .ov-action {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--border-subtle, rgba(255,255,255,0.06));
      border-radius: 10px;
      padding: 16px 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s;
      cursor: pointer;
    }
    .ov-action:hover {
      border-color: var(--spectyra-blue, #5b8def);
      background: rgba(91,141,239,0.06);
    }
    .ov-action-icon {
      font-size: 26px;
      width: 26px;
      height: 26px;
      color: var(--spectyra-blue, #378add);
    }
    .ov-action-label { font-size: 12px; font-weight: 500; color: var(--text-primary, #fff); text-align: center; }

    .ov-next-card {
      background: var(--bg-card, rgba(255,255,255,0.04));
      border: 1px solid var(--spectyra-blue, #5b8def);
      border-radius: 10px;
      padding: 18px 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 28px;
    }
    .ov-next-text { flex: 1; font-size: 13px; color: var(--text-secondary, rgba(255,255,255,0.65)); margin: 0; }

    .ov-footer { margin-top: 16px; }
    .btn-sm { font-size: 12px; padding: 6px 14px; }
  `],
})
export class OpenClawOverviewPage implements OnInit {
  readonly svc = inject(OpenClawDesktopService);
  s: OpenClawStatusSnapshot | null = null;
  nextAction: { message: string; label: string; link: string } | null = null;

  ngOnInit() {
    void this.refresh();
  }

  async refresh() {
    this.s = await this.svc.refreshStatus();
    this.nextAction = this.computeNextAction();
  }

  private computeNextAction() {
    if (!this.s) return null;
    if (!this.s.openclawDetected && !this.s.cliDetected) {
      return {
        message: 'Install OpenClaw on this computer, then come back and copy the Spectyra settings from Setup.',
        label: 'Open setup',
        link: '../setup',
      };
    }
    if (!this.s.companionHealthy) {
      return {
        message: 'Spectyra is still starting. Wait a moment, tap Refresh, or quit the app and open it again.',
        label: 'Health check',
        link: '../diagnostics',
      };
    }
    if (!this.s.providerConfigured) {
      return {
        message: 'Add your AI key on the setup page — it stays on this device only.',
        label: 'Add key',
        link: '../setup',
      };
    }
    if (!this.s.openclawConnected) {
      return {
        message: 'Copy the Spectyra block into OpenClaw once so traffic runs through Spectyra.',
        label: 'Open setup',
        link: '../setup',
      };
    }
    return {
      message: 'You are ready. Open Live to see activity and savings.',
      label: 'Open Live',
      link: '/desktop/live',
    };
  }
}
