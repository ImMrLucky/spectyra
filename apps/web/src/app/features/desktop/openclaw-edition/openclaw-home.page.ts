import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OpenClawDesktopService, type OpenClawStatusSnapshot, type InstalledSkill } from '../../../core/desktop/openclaw-desktop.service';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { TrialLicenseUiService, type LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import type { AssistantProfile } from '../../../../spectyra-window';

@Component({
  selector: 'app-openclaw-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="home">
      <header class="home-header">
        <h1 class="home-title">Spectyra for OpenClaw</h1>
        <p class="home-sub" *ngIf="!loading">
          {{ allHealthy ? 'Everything is running.' : 'Some checks need attention.' }}
        </p>
        <p class="home-sub" *ngIf="loading">Loading status…</p>
      </header>

      <!-- Status strip -->
      <div class="status-strip">
        <div class="status-chip" [class.ok]="s?.companionHealthy" [class.warn]="s && !s.companionHealthy">
          <span class="chip-dot" [class.on]="s?.companionHealthy"></span>
          <span class="chip-label">Companion</span>
          <span class="chip-val">{{ s?.companionHealthy ? 'Running' : 'Offline' }}</span>
        </div>
        <div class="status-chip" [class.ok]="s?.openclawDetected" [class.warn]="s && !s.openclawDetected">
          <span class="chip-dot" [class.on]="s?.openclawDetected"></span>
          <span class="chip-label">OpenClaw</span>
          <span class="chip-val">{{ s?.openclawDetected ? 'Detected' : 'Not found' }}</span>
        </div>
        <div class="status-chip" [class.ok]="s?.providerConfigured" [class.warn]="s && !s.providerConfigured">
          <span class="chip-dot" [class.on]="s?.providerConfigured"></span>
          <span class="chip-label">Provider</span>
          <span class="chip-val">{{ s?.providerConfigured ? providerLabel : 'Not set' }}</span>
        </div>
        <div class="status-chip" [class.ok]="s?.runMode === 'on'" [class.observe]="s?.runMode === 'observe'">
          <span class="chip-dot" [class.on]="s?.runMode === 'on'" [class.observe]="s?.runMode === 'observe'"></span>
          <span class="chip-label">Optimization</span>
          <span class="chip-val">{{ (s?.runMode || '—') | uppercase }}</span>
        </div>
      </div>

      <!-- Next action banner -->
      <div class="next-banner" *ngIf="nextAction">
        <p class="next-text">{{ nextAction.message }}</p>
        <a class="next-link" [routerLink]="nextAction.link">{{ nextAction.label }}</a>
      </div>

      <!-- Savings summary -->
      <div class="savings-card" *ngIf="topline">
        <span class="savings-badge" *ngIf="topline.trialBadge">{{ topline.trialBadge }}</span>
        <span class="savings-headline">{{ topline.optimizationHeadline }}</span>
      </div>

      <!-- Quick-action grid -->
      <div class="qa-grid">
        <a class="qa-card" routerLink="/desktop/live">
          <span class="qa-icon">&#9673;</span>
          <span class="qa-label">Live Dashboard</span>
          <span class="qa-desc">See real-time optimization and savings</span>
        </a>
        <a class="qa-card" routerLink="/desktop/skills">
          <span class="qa-icon">&#9881;</span>
          <span class="qa-label">Skills</span>
          <span class="qa-desc">{{ installedSkillCount }} installed &middot; Browse ClawHub</span>
        </a>
        <a class="qa-card" routerLink="/desktop/assistants">
          <span class="qa-icon">&#9733;</span>
          <span class="qa-label">Assistants</span>
          <span class="qa-desc">{{ assistantCount }} profile{{ assistantCount !== 1 ? 's' : '' }}</span>
        </a>
        <a class="qa-card" routerLink="/desktop/tasks">
          <span class="qa-icon">&#9744;</span>
          <span class="qa-label">Tasks</span>
          <span class="qa-desc">Heartbeats, watchers, scheduled jobs</span>
        </a>
        <a class="qa-card" routerLink="/desktop/setup">
          <span class="qa-icon">&#9889;</span>
          <span class="qa-label">Setup Wizard</span>
          <span class="qa-desc">Re-run install &amp; configuration</span>
        </a>
        <a class="qa-card" routerLink="/desktop/settings">
          <span class="qa-icon">&#9881;</span>
          <span class="qa-label">Settings</span>
          <span class="qa-desc">Provider, aliases, diagnostics</span>
        </a>
      </div>

      <!-- Model aliases reference -->
      <div class="alias-strip" *ngIf="s?.companionHealthy">
        <span class="alias-title">Model aliases</span>
        <span class="alias-item" *ngFor="let m of (s?.modelAliases || [])">{{ m }}</span>
      </div>

      <div class="home-footer">
        <button class="home-refresh" (click)="refresh()" [disabled]="loading">
          {{ loading ? 'Refreshing…' : 'Refresh status' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .home {
      max-width: 720px;
      margin: 0 auto;
      padding: 28px 20px 48px;
      font-family: 'DM Sans', sans-serif;
    }
    .home-header { margin-bottom: 24px; }
    .home-title {
      font-family: 'Source Sans Pro', 'DM Sans', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary, #e8f1fb);
      margin: 0 0 6px;
    }
    .home-sub {
      font-size: 14px;
      color: var(--text-secondary, #7a9fc0);
      margin: 0;
    }

    /* ── Status strip ── */
    .status-strip {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(155px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .status-chip {
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: border-color 0.15s;
    }
    .status-chip.ok { border-color: rgba(29,158,117,0.25); }
    .status-chip.warn { border-color: rgba(239,68,68,0.2); }
    .status-chip.observe { border-color: rgba(186,117,23,0.25); }
    .chip-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #444441;
    }
    .chip-dot.on {
      background: var(--spectyra-teal, #1D9E75);
      animation: pulse 2s ease-in-out infinite;
    }
    .chip-dot.observe { background: var(--spectyra-amber, #BA7517); }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
    .chip-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted, #3d5a78);
    }
    .chip-val {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #e8f1fb);
    }

    /* ── Next action ── */
    .next-banner {
      display: flex;
      align-items: center;
      gap: 16px;
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--spectyra-blue, #378ADD);
      border-radius: 10px;
      padding: 14px 20px;
      margin-bottom: 20px;
    }
    .next-text {
      flex: 1;
      font-size: 13px;
      color: var(--text-secondary, #7a9fc0);
      margin: 0;
    }
    .next-link {
      white-space: nowrap;
      padding: 7px 16px;
      border-radius: 8px;
      background: var(--spectyra-blue, #378ADD);
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s;
    }
    .next-link:hover { background: var(--spectyra-navy-mid, #185FA5); }

    /* ── Savings ── */
    .savings-card {
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .savings-badge {
      font-family: 'DM Mono', monospace;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(29,158,117,0.12);
      color: var(--spectyra-teal-light, #5DCAA5);
    }
    .savings-headline {
      font-size: 13px;
      color: var(--text-secondary, #7a9fc0);
    }

    /* ── Quick-action grid ── */
    .qa-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }
    .qa-card {
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 12px;
      padding: 20px 18px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-decoration: none;
      cursor: pointer;
      transition: border-color 0.15s, background 0.15s;
    }
    .qa-card:hover {
      border-color: var(--spectyra-blue, #378ADD);
      background: var(--bg-elevated, #162236);
    }
    .qa-icon { font-size: 20px; margin-bottom: 2px; }
    .qa-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #e8f1fb);
    }
    .qa-desc {
      font-size: 12px;
      color: var(--text-secondary, #7a9fc0);
    }

    /* ── Aliases ── */
    .alias-strip {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 24px;
    }
    .alias-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted, #3d5a78);
    }
    .alias-item {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 4px;
      background: rgba(55,138,221,0.08);
      color: var(--spectyra-blue-light, #85B7EB);
    }

    /* ── Footer ── */
    .home-footer { margin-top: 8px; }
    .home-refresh {
      padding: 7px 16px;
      border-radius: 8px;
      border: 1px solid var(--border-bright, rgba(55,138,221,0.25));
      background: transparent;
      color: var(--text-secondary, #7a9fc0);
      font-family: 'DM Sans', sans-serif;
      font-size: 12px;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }
    .home-refresh:hover:not(:disabled) {
      border-color: var(--spectyra-blue, #378ADD);
      color: var(--text-primary, #e8f1fb);
    }
    .home-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
  `],
})
export class OpenClawHomePage implements OnInit {
  private readonly oc = inject(OpenClawDesktopService);
  private readonly analytics = inject(CompanionAnalyticsService);
  private readonly trialUi = inject(TrialLicenseUiService);

  s: OpenClawStatusSnapshot | null = null;
  topline: LiveProductTopline | null = null;
  loading = true;
  installedSkillCount = 0;
  assistantCount = 0;
  nextAction: { message: string; label: string; link: string } | null = null;

  get allHealthy(): boolean {
    return !!this.s?.companionHealthy && !!this.s?.providerConfigured;
  }

  get providerLabel(): string {
    switch (this.s?.provider) {
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic';
      case 'groq': return 'Groq';
      default: return this.s?.provider || 'Connected';
    }
  }

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [status, h, skills, profiles] = await Promise.all([
        this.oc.refreshStatus(),
        this.analytics.fetchHealth(),
        this.oc.loadInstalledSkills(),
        this.oc.loadProfiles(),
      ]);

      this.s = status;
      this.topline = this.trialUi.computeTopline(h);
      this.installedSkillCount = skills.length;
      this.assistantCount = profiles.length;
      this.nextAction = this.computeNextAction(status);
    } finally {
      this.loading = false;
    }
  }

  private computeNextAction(s: OpenClawStatusSnapshot): { message: string; label: string; link: string } | null {
    if (!s.openclawDetected && !s.cliDetected) {
      return {
        message: 'OpenClaw is not installed yet. Run the setup wizard to get started.',
        label: 'Run setup',
        link: '/desktop/setup',
      };
    }
    if (!s.companionHealthy) {
      return {
        message: 'The Spectyra companion is not responding. Check settings or restart.',
        label: 'Settings',
        link: '/desktop/settings',
      };
    }
    if (!s.providerConfigured) {
      return {
        message: 'Add your AI provider key so Spectyra can forward requests.',
        label: 'Add key',
        link: '/desktop/setup',
      };
    }
    if (!s.openclawConnected) {
      return {
        message: 'Copy the Spectyra config block into OpenClaw so traffic routes through Spectyra.',
        label: 'Setup',
        link: '/desktop/setup',
      };
    }
    return null;
  }
}
