import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';
import { IntegrationOnboardingService } from '../../integrations/services/integration-onboarding.service';
import { LocalCompanionDiagnosticsService } from '../../../core/desktop/local-companion-diagnostics.service';
import { DESKTOP_SETUP, friendlyProviderKeyUserMessage } from '../../../core/desktop/desktop-setup-messages';
import { OPENCLAW_INSTALL_BASH, OPENCLAW_NODE_VERSION_MIN } from '@spectyra/shared';

/**
 * Single-screen OpenClaw setup: key → copy config → Live.
 * Full wizard lives at ../setup/guide.
 */
@Component({
  selector: 'app-openclaw-simple-setup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="simple">
      <header class="simple-head">
        <h1 class="simple-title">OpenClaw setup</h1>
        <p class="simple-lead">
          Three steps: add your AI key (stays on this computer), copy one block into OpenClaw, then use Live.
        </p>
      </header>

      <section class="simple-card simple-card-muted" *ngIf="canTerminal">
        <h2 class="simple-h2">Active provider</h2>
        <p class="simple-p">
          The companion is using <strong>{{ activeProviderLabel }}</strong> for every client (OpenClaw, Live, SDK).
          Saved keys on disk: <span class="simple-mono">{{ savedKeysSummary }}</span>
        </p>
        <p class="simple-p">
          For <strong>cost vs quality per task</strong>, keep one provider here and pick
          <span class="simple-mono">spectyra/fast</span> or <span class="simple-mono">spectyra/quality</span> in OpenClaw per agent or request — or remap those in
          <a routerLink="/desktop/settings">Settings → Model names for aliases</a>.
        </p>
        <div class="simple-row simple-row-inline">
          <label class="simple-label" for="sp-switch-provider">Switch active provider</label>
          <select
            id="sp-switch-provider"
            class="simple-input simple-input-narrow"
            [(ngModel)]="switchPick"
            [disabled]="switchBusy"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
          </select>
          <button type="button" class="btn-secondary" [disabled]="switchBusy || switchPick === activeProvider" (click)="applySwitch()">
            {{ switchBusy ? 'Applying…' : 'Use without pasting key' }}
          </button>
        </div>
        <p class="simple-err" *ngIf="switchErr">{{ switchErr }}</p>
      </section>

      <section class="simple-card">
        <h2 class="simple-h2">1. Your AI key</h2>
        <p class="simple-p">OpenAI, Anthropic, or Groq — same key you use elsewhere. We never send it to Spectyra’s servers.</p>
        <div class="simple-row">
          <label class="simple-label" for="sp-provider">Provider</label>
          <select
            id="sp-provider"
            class="simple-input"
            [(ngModel)]="provider"
            [disabled]="saving"
            (ngModelChange)="onProviderPickChange()"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
          </select>
        </div>
        <div class="simple-row">
          <label class="simple-label" for="sp-key">API key</label>
          <input id="sp-key" class="simple-input" type="password" [(ngModel)]="apiKey" placeholder="Paste key here"
                 [disabled]="saving" autocomplete="off" />
        </div>
        <p class="simple-err" *ngIf="errorMsg">{{ errorMsg }}</p>
        <details class="simple-tech" *ngIf="technicalDetail && errorMsg">
          <summary>{{ setup.technicalDetailsLabel }}</summary>
          <pre class="simple-pre">{{ technicalDetail }}</pre>
        </details>
        <p class="simple-ok" *ngIf="keyOk && !errorMsg">{{ setup.providerSaveSuccess }}</p>
        <button type="button" class="btn-primary" (click)="saveKey()" [disabled]="saving || !apiKey.trim()">
          {{ saving ? 'Saving…' : 'Save key' }}
        </button>
      </section>

      <section class="simple-card">
        <h2 class="simple-h2">2. Connect OpenClaw</h2>
        <p class="simple-p">Copy the settings below into OpenClaw’s config (or use OpenClaw’s onboarding if it asks for a provider URL).</p>
        <button type="button" class="btn-primary" (click)="copyConfig()" [disabled]="!configJson">Copy Spectyra settings</button>
        <p class="simple-hint" *ngIf="copyDone">Copied. Paste into OpenClaw, save, and restart OpenClaw if it asks.</p>
      </section>

      <section class="simple-card">
        <h2 class="simple-h2">3. Don’t have OpenClaw yet?</h2>
        <p class="simple-p">You need Node.js {{ nodeMin }}+, then run the official installer in a terminal.</p>
        <pre class="simple-pre sm">{{ installLine }}</pre>
        <button type="button" class="btn-secondary" (click)="copyInstall()">Copy install command</button>
        <button type="button" class="btn-secondary" *ngIf="canTerminal" (click)="runTerminal()">Open terminal installer</button>
        <p class="simple-err" *ngIf="terminalErr">{{ terminalErr }}</p>
      </section>

      <div class="simple-actions">
        <button type="button" class="btn-primary" routerLink="/desktop/live">Open Live</button>
        <a class="simple-link" routerLink="guide">Full step-by-step guide</a>
      </div>
    </div>
  `,
  styles: [
    `
      .simple { max-width: 520px; padding: 8px 0 32px; }
      .simple-head { margin-bottom: 20px; }
      .simple-title {
        font-family: 'Source Sans Pro', 'DM Sans', sans-serif;
        font-size: 22px;
        font-weight: 700;
        color: var(--text-primary, #fff);
        margin: 0 0 8px;
      }
      .simple-lead {
        font-size: 13px;
        color: var(--text-secondary, rgba(255, 255, 255, 0.6));
        margin: 0;
        line-height: 1.45;
      }
      .simple-card {
        background: var(--bg-card, rgba(255, 255, 255, 0.04));
        border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
        border-radius: 12px;
        padding: 18px 20px;
        margin-bottom: 16px;
      }
      .simple-h2 {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary, #fff);
        margin: 0 0 8px;
      }
      .simple-p {
        font-size: 12px;
        color: var(--text-muted, rgba(255, 255, 255, 0.5));
        margin: 0 0 12px;
        line-height: 1.45;
      }
      .simple-row { margin-bottom: 10px; }
      .simple-label {
        display: block;
        font-size: 11px;
        color: var(--text-muted, rgba(255, 255, 255, 0.45));
        margin-bottom: 4px;
      }
      .simple-input {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border-radius: 8px;
        border: 1px solid var(--border-bright, rgba(255, 255, 255, 0.12));
        background: var(--bg-input, rgba(0, 0, 0, 0.25));
        color: var(--text-primary, #fff);
        font-size: 13px;
      }
      .simple-err {
        color: #f87171;
        font-size: 12px;
        margin: 8px 0;
      }
      .simple-ok {
        color: #4ade80;
        font-size: 12px;
        margin: 8px 0;
      }
      .simple-hint {
        color: var(--text-muted, rgba(255, 255, 255, 0.5));
        font-size: 12px;
        margin-top: 10px;
      }
      .simple-pre {
        background: rgba(0, 0, 0, 0.35);
        padding: 10px 12px;
        border-radius: 8px;
        font-size: 11px;
        overflow-x: auto;
        color: var(--text-secondary, rgba(255, 255, 255, 0.75));
        margin: 8px 0 12px;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .simple-pre.sm { font-size: 10px; }
      .simple-tech {
        margin: 8px 0 12px;
        font-size: 11px;
        color: var(--text-muted, rgba(255, 255, 255, 0.45));
      }
      .simple-tech summary { cursor: pointer; margin-bottom: 6px; }
      .simple-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        align-items: center;
        margin-top: 8px;
      }
      .simple-link {
        font-size: 12px;
        color: var(--spectyra-blue, #5b8def);
      }
      .simple-card-muted {
        border-style: dashed;
        opacity: 0.95;
      }
      .simple-mono {
        font-family: ui-monospace, monospace;
        font-size: 11px;
        color: var(--text-secondary, rgba(255, 255, 255, 0.75));
      }
      .simple-row-inline {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 10px;
      }
      .simple-row-inline .simple-label {
        width: 100%;
        margin-bottom: 0;
      }
      .simple-input-narrow {
        max-width: 200px;
      }
    `,
  ],
})
export class OpenClawSimpleSetupPage implements OnInit {
  private readonly desktop = inject(DesktopBridgeService);
  private readonly onboarding = inject(IntegrationOnboardingService);
  private readonly diagnostics = inject(LocalCompanionDiagnosticsService);
  readonly setup = DESKTOP_SETUP;
  readonly nodeMin = OPENCLAW_NODE_VERSION_MIN;
  readonly installLine = OPENCLAW_INSTALL_BASH;

  /** Configured upstream (companion); may differ from `provider` while editing keys for another vendor. */
  activeProvider = 'openai';
  provider = 'openai';
  apiKey = '';
  saving = false;
  errorMsg: string | null = null;
  technicalDetail: string | null = null;
  keyOk = false;
  configJson = '';
  copyDone = false;
  terminalErr: string | null = null;
  canTerminal = false;

  switchPick = 'openai';
  switchBusy = false;
  switchErr: string | null = null;

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

  get savedKeysSummary(): string {
    return this._savedKeyNames.length ? this._savedKeyNames.join(', ') : 'none yet';
  }

  private _savedKeyNames: string[] = [];

  ngOnInit(): void {
    this.canTerminal = this.desktop.isElectronRenderer;
    void this.load();
  }

  async onProviderPickChange(): Promise<void> {
    const cfg = await this.desktop.getConfig();
    const keys = cfg?.['providerKeys'] as Record<string, string> | undefined;
    this.apiKey = keys?.[this.provider]?.trim() ? keys[this.provider]! : '';
  }

  async applySwitch(): Promise<void> {
    this.switchErr = null;
    this.switchBusy = true;
    try {
      const r = await this.desktop.setActiveProvider(this.switchPick);
      if (r.ok) {
        await this.load();
      } else {
        this.switchErr = r.error;
      }
    } finally {
      this.switchBusy = false;
    }
  }

  private async load(): Promise<void> {
    try {
      this.configJson = await this.diagnostics.buildOpenClawConfigJson();
    } catch {
      this.configJson = (await this.desktop.openClawExample()) || '';
    }
    const cfg = await this.desktop.getConfig();
    if (cfg && typeof cfg['provider'] === 'string') {
      const p = cfg['provider'] as string;
      this.activeProvider = p;
      this.provider = p;
    }
    this.switchPick = this.activeProvider;
    const keys = cfg?.['providerKeys'] as Record<string, string> | undefined;
    this._savedKeyNames = keys ? Object.keys(keys).filter((k) => keys[k]?.trim()) : [];
    const k = keys?.[this.provider];
    if (k) this.apiKey = k;
  }

  /** After saving a key, refresh banner + OpenClaw snippet without putting the secret back in the input. */
  private async reloadProviderBanner(): Promise<void> {
    try {
      this.configJson = await this.diagnostics.buildOpenClawConfigJson();
    } catch {
      this.configJson = (await this.desktop.openClawExample()) || '';
    }
    const cfg = await this.desktop.getConfig();
    if (cfg && typeof cfg['provider'] === 'string') {
      const p = cfg['provider'] as string;
      this.activeProvider = p;
      this.provider = p;
    }
    this.switchPick = this.activeProvider;
    const keys = cfg?.['providerKeys'] as Record<string, string> | undefined;
    this._savedKeyNames = keys ? Object.keys(keys).filter((k) => keys[k]?.trim()) : [];
  }

  async saveKey(): Promise<void> {
    if (!this.apiKey.trim()) return;
    this.saving = true;
    this.errorMsg = null;
    this.technicalDetail = null;
    this.keyOk = false;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        const result = await this.desktop.setProviderKey(this.provider, this.apiKey.trim());
        const friendly = friendlyProviderKeyUserMessage(result);
        if (friendly.success) {
          this.keyOk = true;
          this.apiKey = '';
          await this.reloadProviderBanner();
          await this.onboarding.refreshOpenClawStatus();
          return;
        }
        if (attempt === 2) {
          this.errorMsg = friendly.message;
          this.technicalDetail = friendly.technical ?? null;
        }
      }
    } catch (e: unknown) {
      this.errorMsg = DESKTOP_SETUP.providerSaveFailed;
      this.technicalDetail = e instanceof Error ? e.message : String(e);
    } finally {
      this.saving = false;
    }
  }

  async copyConfig(): Promise<void> {
    this.copyDone = false;
    try {
      await this.onboarding.copyOpenClawConfig();
      this.copyDone = true;
    } catch {
      try {
        await navigator.clipboard.writeText(this.configJson);
        this.copyDone = true;
      } catch {
        this.copyDone = false;
      }
    }
  }

  copyInstall(): void {
    void navigator.clipboard.writeText(this.installLine);
  }

  async runTerminal(): Promise<void> {
    this.terminalErr = null;
    const r = await this.desktop.runOpenClawOnboardInTerminal({});
    if (!r.ok) this.terminalErr = 'Could not open the terminal. Copy the command above and run it yourself.';
  }
}
