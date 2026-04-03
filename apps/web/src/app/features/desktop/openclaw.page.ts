import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  buildOpenClawFullInstallLine,
  buildOpenClawOnboardCli,
  buildOpenClawOnboardPowerShell,
  OPENCLAW_INSTALL_BASH,
  OPENCLAW_INSTALL_POWERSHELL,
  OPENCLAW_NODE_VERSION_MIN,
  type OpenClawInstallPlatform,
  type OpenClawOnboardOptions,
} from '@spectyra/shared';
import { DesktopBridgeService } from '../../core/desktop/desktop-bridge.service';
import { CompanionAnalyticsService } from '../../core/analytics/companion-analytics.service';
import { LocalCompanionDiagnosticsService } from '../../core/desktop/local-companion-diagnostics.service';
import { environment } from '../../../environments/environment';
import type { OpenClawWizardBlocker, OpenClawWizardStatus } from '@spectyra/openclaw-bridge';

@Component({
  selector: 'app-desktop-openclaw',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './openclaw/openclaw.page.html',
  styles: [
    `
      .oc-wizard {
        max-width: 780px;
        margin: 0 auto;
        padding: 24px 20px 48px;
        font-family: var(--font-body);
      }

      /* ── Progress ── */
      .oc-progress {
        display: flex;
        gap: 4px;
        margin-bottom: 28px;
        flex-wrap: wrap;
      }

      .oc-step {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: var(--text-muted);
        padding: 4px 10px;
        border-radius: 999px;
        cursor: pointer;
        transition: color 0.15s ease;

        &:hover { color: var(--text-secondary); }
        &.active { color: var(--text-secondary); }
        &.current {
          color: var(--spectyra-blue);
          background: rgba(55, 138, 221, 0.08);
          font-weight: 500;
        }
      }

      .oc-step-num {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 600;
        background: var(--bg-elevated);
        color: var(--text-muted);
      }

      .oc-step.active .oc-step-num {
        background: var(--spectyra-blue);
        color: var(--spectyra-blue-pale);
      }

      /* ── Step content ── */
      .oc-step-content { animation: ocFade 200ms ease-out; }

      .oc-title {
        margin: 0 0 8px;
        font-family: var(--font-display);
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .oc-sub {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.55;
        margin-bottom: 20px;
      }

      .back-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        font-family: var(--font-body);
        font-size: 12px;
        cursor: pointer;
        padding: 0;
        margin-bottom: 14px;
        display: block;

        &:hover { color: var(--text-secondary); }
      }

      /* ── Info card ── */
      .oc-info-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 16px;
        margin-bottom: 20px;
      }

      .oc-info-card.compact { padding: 12px 14px; }

      .oc-info-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        display: block;
        margin-bottom: 10px;
      }

      .oc-info-detail {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.5;
        margin: 0;
      }

      .oc-info-detail code {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 1px 5px;
        border-radius: 3px;
        background: var(--bg-elevated);
        color: var(--spectyra-blue-light);
      }

      /* ── Flow diagram ── */
      .oc-flow {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }

      .oc-flow-node {
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 12px;
        color: var(--text-secondary);
        background: var(--bg-elevated);
      }

      .oc-flow-node.active {
        border-color: var(--spectyra-blue);
        color: var(--spectyra-blue);
        background: rgba(55, 138, 221, 0.06);
      }

      .oc-flow-arrow {
        color: var(--text-muted);
        font-size: 14px;
      }

      /* ── Path choice ── */
      .oc-path-choice { margin-bottom: 20px; }

      .oc-path-btn {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 14px 16px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        cursor: pointer;
        text-align: left;
        margin-bottom: 8px;
        transition: border-color 0.15s ease;

        &:hover { border-color: var(--border-bright); }
        &.selected { border-color: var(--spectyra-blue); }
      }

      .oc-path-btn .material-icons { font-size: 22px; color: var(--spectyra-blue); }
      .oc-pb-label { font-size: 13px; font-weight: 500; color: var(--text-primary); flex: 1; }
      .oc-pb-desc { font-size: 11px; color: var(--text-secondary); }

      /* ── Code card ── */
      .oc-code-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        padding: 14px 16px;
        margin-bottom: 16px;
        position: relative;
      }

      .oc-run-hint {
        margin-top: 0;
        margin-bottom: 16px;
      }

      .oc-run-hint a {
        color: var(--spectyra-blue);
      }

      .oc-node-prereq {
        background: rgba(55, 138, 221, 0.06);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        padding: 12px 14px;
        margin-bottom: 16px;
      }

      .oc-node-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        display: block;
        margin-bottom: 6px;
      }

      .oc-node-text {
        margin: 0;
        font-size: 12px;
        line-height: 1.55;
        color: var(--text-secondary);
      }

      .oc-node-text a {
        color: var(--spectyra-blue);
      }

      .oc-code-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-top: 12px;
      }

      .oc-advanced {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        padding: 12px 14px 14px;
        margin-bottom: 16px;
      }

      .oc-advanced summary {
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        list-style: none;
      }

      .oc-advanced summary::-webkit-details-marker {
        display: none;
      }

      .oc-adv-intro {
        margin-top: 12px;
        margin-bottom: 12px;
      }

      .oc-field {
        margin-bottom: 12px;
      }

      .oc-field-label {
        display: block;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--text-muted);
        margin-bottom: 6px;
      }

      .oc-select,
      .oc-input {
        width: 100%;
        max-width: 420px;
        box-sizing: border-box;
        padding: 8px 10px;
        border-radius: 6px;
        border: 1px solid var(--border);
        background: var(--bg-elevated);
        color: var(--text-primary);
        font-family: var(--font-body);
        font-size: 13px;
      }

      .oc-radio-row {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
        align-items: center;
      }

      .oc-radio {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--text-secondary);
        cursor: pointer;
      }

      .oc-one-liner-hint {
        font-size: 11px;
        margin-top: 10px;
        margin-bottom: 0;
      }

      .oc-one-liner-code {
        display: block;
        margin-top: 6px;
        font-size: 10px;
        line-height: 1.45;
        word-break: break-word;
        white-space: pre-wrap;
      }

      .oc-error {
        color: var(--color-danger, #c62828);
        font-size: 12px;
        margin: 0 0 12px;
      }

      .oc-code-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        display: block;
        margin-bottom: 8px;
      }

      .oc-code {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--text-primary);
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        line-height: 1.6;
      }

      .oc-hint {
        font-size: 12px;
        color: var(--text-muted);
        line-height: 1.5;
        margin-bottom: 16px;
      }

      .oc-hint code {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 1px 5px;
        border-radius: 3px;
        background: var(--bg-elevated);
        color: var(--spectyra-blue-light);
      }

      /* ── Command grid ── */
      .oc-cmd-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 8px;
        margin-bottom: 16px;
      }

      .oc-cmd-grid.compact {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      }

      .oc-cmd-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: 6px;
        padding: 10px 12px;
        position: relative;
      }

      .oc-cmd-label {
        font-size: 10px;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        display: block;
        margin-bottom: 4px;
      }

      .oc-cmd-code {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--spectyra-blue-light);
        word-break: break-all;
      }

      /* ── Status card ── */
      .oc-status-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        padding: 12px 14px;
        margin-bottom: 12px;

        &.ok { border-color: var(--spectyra-teal-border); }
      }

      .oc-sc-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .oc-sc-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--dot-offline);

        &.on { background: var(--dot-healthy); }
      }

      .oc-sc-label {
        font-size: 13px;
        color: var(--text-primary);
      }

      .oc-sc-detail {
        font-size: 11px;
        color: var(--text-secondary);
        display: block;
        margin-top: 6px;
        padding-left: 15px;
      }

      .oc-validate-actions {
        display: flex;
        gap: 10px;
        margin-top: 12px;
      }

      .oc-hint a {
        color: var(--spectyra-blue);
      }

      /* ── Troubleshoot ── */
      .oc-ts-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 20px;
      }

      .oc-ts-item {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        padding: 14px 16px;

        h3 {
          margin: 0 0 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        p {
          margin: 0;
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        code {
          font-family: var(--font-mono);
          font-size: 11px;
          padding: 1px 5px;
          border-radius: 3px;
          background: var(--bg-elevated);
          color: var(--spectyra-blue-light);
        }

        a {
          color: var(--spectyra-blue);
          text-decoration: none;
          &:hover { text-decoration: underline; }
        }
      }

      /* ── Go live ── */
      .oc-go-live {
        text-align: center;
        padding: 40px 20px;
      }

      .oc-gl-dot {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--spectyra-teal);
        animation: pulse 2s ease-in-out infinite;
        margin-bottom: 16px;
      }

      .oc-gl-title {
        font-family: var(--font-display);
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 10px;
      }

      .oc-gl-sub {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.55;
        margin-bottom: 20px;
        max-width: 480px;
        margin-left: auto;
        margin-right: auto;
      }

      .oc-gl-hint {
        color: var(--text-muted);
        font-size: 11px;
        margin-top: 14px;
      }

      /* ── Buttons ── */
      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        background: var(--spectyra-navy);
        color: var(--spectyra-blue-pale);
        border: none;
        border-radius: 6px;
        font-family: var(--font-body);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.15s ease;

        &:hover { background: var(--spectyra-navy-mid); }
        &:disabled { opacity: 0.4; cursor: not-allowed; }
      }

      .btn-secondary {
        display: inline-flex;
        align-items: center;
        padding: 8px 18px;
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-bright);
        border-radius: 6px;
        font-family: var(--font-body);
        font-size: 13px;
        cursor: pointer;

        &:hover { border-color: var(--spectyra-blue); color: var(--text-primary); }
      }

      .btn-copy {
        position: absolute;
        top: 10px;
        right: 10px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: 4px;
        color: var(--text-secondary);
        font-size: 10px;
        padding: 3px 8px;
        cursor: pointer;

        &:hover { border-color: var(--spectyra-blue); color: var(--text-primary); }
      }

      .btn-copy-sm {
        background: none;
        border: none;
        color: var(--text-muted);
        font-size: 10px;
        cursor: pointer;
        padding: 2px 0;
        margin-top: 4px;
        display: block;

        &:hover { color: var(--spectyra-blue); }
      }

      @keyframes ocFade {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
    `,
  ],
})
export class DesktopOpenClawPage implements OnInit {
  step = 1;
  userPath: 'new' | 'existing' | null = null;
  /** Set from actual Electron companion port (see ngOnInit). */
  baseV1 = `${environment.companionBaseUrl}/v1`;
  json = '';
  /** Legacy shape for templates — derived from {@link wizardStatus}. */
  health: Record<string, unknown> | null = null;
  modelsMessage = '';
  wizardStatus: OpenClawWizardStatus | null = null;
  diagnosticsSummary = '';

  /** From Electron main process — drives “where to run” copy. */
  installPlatform: 'darwin' | 'win32' | 'linux' | 'other' = 'other';
  canRunOnboardTerminal = false;
  terminalOnboardError: string | null = null;

  /** Optional `openclaw onboard` flags (shared with Electron terminal runner). */
  onboardFlow: 'default' | 'quickstart' | 'manual' = 'default';
  onboardMode: 'local' | 'remote' = 'local';
  remoteUrl = '';

  readonly stepLabels = ['Overview', 'Install', 'Companion', 'Configure', 'Validate', 'Troubleshoot', 'Go live'];

  readonly defaultConfigSnippet = `{
  "customProvider": {
    "name": "spectyra",
    "baseUrl": "http://localhost:4111/v1",
    "model": "spectyra/smart"
  }
}`;

  readonly verifyCommands = [
    { label: 'Check status', command: 'openclaw status' },
    { label: 'Check health', command: 'openclaw health' },
    { label: 'List models', command: 'openclaw models list' },
  ];

  readonly troubleshootCommands = [
    { label: 'Doctor', command: 'openclaw doctor' },
    { label: 'Logs', command: 'openclaw logs' },
    { label: 'Config path', command: 'openclaw config path' },
  ];

  readonly allCommands = [
    { label: 'Status', command: 'openclaw status' },
    { label: 'Health', command: 'openclaw health' },
    { label: 'Models', command: 'openclaw models list' },
    { label: 'Doctor', command: 'openclaw doctor' },
    { label: 'Logs', command: 'openclaw logs' },
    { label: 'Config', command: 'openclaw config path' },
  ];

  constructor(
    private desktop: DesktopBridgeService,
    private companionAnalytics: CompanionAnalyticsService,
    private localDiagnostics: LocalCompanionDiagnosticsService,
  ) {}

  get installGuide() {
    return this.localDiagnostics.installGuide;
  }

  async ngOnInit() {
    try {
      this.json = await this.localDiagnostics.buildOpenClawConfigJson();
    } catch {
      this.json = (await this.desktop.openClawExample()) || '';
    }
    this.canRunOnboardTerminal = this.desktop.isElectronRenderer;
    const info = await this.desktop.getAppInfo();
    const p = info?.['platform'];
    if (p === 'darwin' || p === 'win32' || p === 'linux') {
      this.installPlatform = p;
    }
    const origin = await this.companionAnalytics.resolveCompanionOrigin();
    this.baseV1 = `${origin}/v1`;
    await this.refreshDiagnostics();
  }

  readonly openClawNodeMin = OPENCLAW_NODE_VERSION_MIN;

  get installFirstLine(): string {
    return this.installPlatform === 'win32' ? OPENCLAW_INSTALL_POWERSHELL : OPENCLAW_INSTALL_BASH;
  }

  get platformForOpenClaw(): OpenClawInstallPlatform {
    if (this.installPlatform === 'darwin' || this.installPlatform === 'win32' || this.installPlatform === 'linux') {
      return this.installPlatform;
    }
    return 'other';
  }

  getOnboardOpts(): OpenClawOnboardOptions {
    const o: OpenClawOnboardOptions = {};
    if (this.onboardFlow === 'quickstart') o.flow = 'quickstart';
    if (this.onboardFlow === 'manual') o.flow = 'manual';
    if (this.onboardMode === 'remote') {
      o.mode = 'remote';
      o.remoteUrl = this.remoteUrl.trim();
    }
    return o;
  }

  get onboardCliDisplayLine(): string {
    try {
      if (this.installPlatform === 'win32') {
        return buildOpenClawOnboardPowerShell(this.getOnboardOpts());
      }
      return buildOpenClawOnboardCli(this.getOnboardOpts());
    } catch {
      return 'openclaw onboard …';
    }
  }

  get fullInstallOneLineDisplay(): string {
    try {
      return buildOpenClawFullInstallLine(this.getOnboardOpts(), this.platformForOpenClaw);
    } catch {
      return '';
    }
  }

  get onboardCommandError(): string | null {
    try {
      if (this.installPlatform === 'win32') {
        buildOpenClawOnboardPowerShell(this.getOnboardOpts());
      } else {
        buildOpenClawOnboardCli(this.getOnboardOpts());
      }
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }

  async copyFullInstallLine() {
    this.terminalOnboardError = null;
    try {
      await navigator.clipboard.writeText(
        buildOpenClawFullInstallLine(this.getOnboardOpts(), this.platformForOpenClaw),
      );
    } catch (e) {
      this.terminalOnboardError = e instanceof Error ? e.message : String(e);
    }
  }

  async runOnboardInTerminal() {
    this.terminalOnboardError = null;
    const opts = this.getOnboardOpts();
    try {
      if (this.installPlatform === 'win32') {
        buildOpenClawOnboardPowerShell(opts);
      } else {
        buildOpenClawOnboardCli(opts);
      }
    } catch (e) {
      this.terminalOnboardError = e instanceof Error ? e.message : String(e);
      return;
    }
    const r = await this.desktop.runOpenClawOnboardInTerminal(opts);
    if (!r.ok) {
      this.terminalOnboardError = r.error ?? 'Could not open a terminal.';
    }
  }

  async refreshDiagnostics() {
    try {
      this.wizardStatus = await this.localDiagnostics.runDiagnostics();
      const h = this.wizardStatus.health;
      const ok = this.wizardStatus.blocker === 'none';
      this.health = {
        status: ok ? 'ok' : 'degraded',
        runMode: h.runMode,
        companionReady: h.companionReady,
        providerConfigured: h.providerConfigured,
        licenseKeyPresent: h.licenseKeyPresent,
      };
      const m = this.wizardStatus.models;
      this.modelsMessage =
        m.ok && m.modelIds.length > 0
          ? `OK — models: ${m.modelIds.join(', ')}`
          : m.message || 'Models probe incomplete.';
      this.diagnosticsSummary = this.describeWizardBlocker(this.wizardStatus.blocker);
    } catch {
      this.wizardStatus = null;
      this.health = null;
      this.modelsMessage = '';
      this.diagnosticsSummary = 'Could not run diagnostics.';
    }
  }

  /** @deprecated Use refreshDiagnostics — kept for template compatibility */
  async refreshHealth() {
    await this.refreshDiagnostics();
  }

  describeWizardBlocker(blocker: OpenClawWizardBlocker): string {
    switch (blocker) {
      case 'none':
        return 'Local Companion is reachable, provider is configured, and model aliases are available.';
      case 'companion_unreachable':
        return 'Spectyra Local Companion is not reachable on localhost. Open the Spectyra desktop app or start the companion.';
      case 'companion_not_ready':
        return 'Companion responded but is not fully ready (check run mode and that the process finished starting).';
      case 'provider_not_configured':
        return 'Set your provider API key in Desktop settings so the companion can forward requests to your AI provider.';
      default:
        return '';
    }
  }

  async test() {
    await this.refreshDiagnostics();
  }

  async copy() {
    if (!this.json) {
      try {
        this.json = await this.localDiagnostics.buildOpenClawConfigJson();
      } catch {
        this.json = (await this.desktop.openClawExample()) || '';
      }
    }
    await navigator.clipboard.writeText(this.json);
  }

  async copyCmd(cmd: string) {
    await navigator.clipboard.writeText(cmd);
  }

  goToStep(s: number) {
    if (s >= 1 && s <= 7) this.step = s;
  }
}
