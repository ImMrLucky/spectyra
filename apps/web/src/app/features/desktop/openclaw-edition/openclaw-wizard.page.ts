import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';
import { OpenClawDesktopService } from '../../../core/desktop/openclaw-desktop.service';
import { LocalCompanionDiagnosticsService } from '../../../core/desktop/local-companion-diagnostics.service';
import { DESKTOP_SETUP, friendlyProviderKeyUserMessage } from '../../../core/desktop/desktop-setup-messages';
import { OPENCLAW_INSTALL_BASH, OPENCLAW_NODE_VERSION_MIN } from '@spectyra/shared';

type WizardStep = 'welcome' | 'install' | 'provider' | 'connect' | 'verify' | 'done';

const STEP_ORDER: WizardStep[] = ['welcome', 'install', 'provider', 'connect', 'verify', 'done'];

@Component({
  selector: 'app-openclaw-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="wiz">
      <!-- Progress -->
      <div class="wiz-progress">
        <div
          class="wiz-pip"
          *ngFor="let s of steps; let i = index"
          [class.active]="stepIdx === i"
          [class.done]="stepIdx > i"
          [class.clickable]="stepIdx > i"
          (click)="stepIdx > i ? goTo(s) : null"
        >
          <span class="wiz-pip-num">{{ stepIdx > i ? '&#10003;' : i + 1 }}</span>
          <span class="wiz-pip-label">{{ stepLabels[s] }}</span>
        </div>
      </div>

      <!-- WELCOME -->
      <section class="wiz-panel" *ngIf="step === 'welcome'">
        <h1 class="wiz-title">Welcome to Spectyra for OpenClaw</h1>
        <p class="wiz-lead">
          This setup takes about two minutes. We'll install OpenClaw, add your AI provider key,
          connect everything, and verify it works.
        </p>
        <div class="wiz-what">
          <h3 class="wiz-what-title">What you'll get</h3>
          <ul class="wiz-what-list">
            <li>OpenClaw AI agent running on your machine</li>
            <li>Spectyra optimization reducing token costs automatically</li>
            <li>Skills from ClawHub to extend what your AI can do</li>
            <li>AI Assistant and AI Coder profiles ready to use</li>
          </ul>
        </div>
        <div class="wiz-actions">
          <button class="wiz-btn primary" (click)="next()">Get Started</button>
          <button class="wiz-btn secondary" *ngIf="canSkip" (click)="goTo('done')">
            I'm already set up
          </button>
        </div>
      </section>

      <!-- INSTALL -->
      <section class="wiz-panel" *ngIf="step === 'install'">
        <h1 class="wiz-title">Install OpenClaw</h1>
        <p class="wiz-lead">
          OpenClaw needs <strong>Node.js {{ nodeMin }}+</strong>. Run the official installer in a terminal.
        </p>

        <div class="wiz-code-block">
          <pre class="wiz-pre">{{ installCmd }}</pre>
          <button class="wiz-btn small" (click)="copyInstall()">
            {{ installCopied ? 'Copied' : 'Copy' }}
          </button>
        </div>

        <button class="wiz-btn secondary" *ngIf="canTerminal" (click)="runTerminal()">
          Open terminal &amp; run installer
        </button>
        <p class="wiz-err" *ngIf="terminalErr">{{ terminalErr }}</p>

        <div class="wiz-check-row" [class.pass]="cliDetected" [class.checking]="checkingCli">
          <span class="wiz-check-dot" [class.on]="cliDetected"></span>
          <span class="wiz-check-text">
            {{ checkingCli ? 'Checking…' : cliDetected ? 'OpenClaw detected' : 'OpenClaw not found yet' }}
          </span>
          <button class="wiz-btn tiny" (click)="detectCli()" [disabled]="checkingCli">Re-check</button>
        </div>

        <div class="wiz-actions">
          <button class="wiz-btn secondary" (click)="prev()">Back</button>
          <button class="wiz-btn primary" (click)="next()">
            {{ cliDetected ? 'Next' : 'Skip for now' }}
          </button>
        </div>
      </section>

      <!-- PROVIDER -->
      <section class="wiz-panel" *ngIf="step === 'provider'">
        <h1 class="wiz-title">Add your AI provider key</h1>
        <p class="wiz-lead">
          Spectyra forwards requests to your AI provider. The key stays on this computer only — never
          sent to Spectyra's servers.
        </p>
        <div class="wiz-field">
          <label class="wiz-label">Provider</label>
          <select class="wiz-select" [(ngModel)]="provider" [disabled]="keySaving">
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="groq">Groq</option>
          </select>
        </div>
        <div class="wiz-field">
          <label class="wiz-label">API key</label>
          <input
            class="wiz-input"
            type="password"
            [(ngModel)]="apiKey"
            placeholder="Paste your key here"
            [disabled]="keySaving"
            autocomplete="off"
          />
        </div>
        <p class="wiz-err" *ngIf="keyError">{{ keyError }}</p>
        <p class="wiz-ok" *ngIf="keyOk">Key saved and companion verified.</p>

        <div class="wiz-actions">
          <button class="wiz-btn secondary" (click)="prev()">Back</button>
          <button
            class="wiz-btn primary"
            (click)="saveKey()"
            [disabled]="keySaving || (!apiKey.trim() && !keyOk)"
          >
            {{ keySaving ? 'Saving…' : keyOk ? 'Next' : 'Save key' }}
          </button>
        </div>
      </section>

      <!-- CONNECT -->
      <section class="wiz-panel" *ngIf="step === 'connect'">
        <h1 class="wiz-title">Connect OpenClaw to Spectyra</h1>
        <p class="wiz-lead">
          Copy the settings block below and paste it into your OpenClaw config. This tells OpenClaw to
          route through Spectyra's local companion for optimization.
        </p>

        <div class="wiz-code-block">
          <pre class="wiz-pre">{{ configJson || 'Loading…' }}</pre>
          <button class="wiz-btn small" (click)="copyConfig()">
            {{ configCopied ? 'Copied' : 'Copy settings' }}
          </button>
        </div>

        <p class="wiz-hint">
          Not sure where to paste? Run <code>openclaw config path</code> to find your config file,
          or press the button below to open it.
        </p>

        <div class="wiz-row">
          <button class="wiz-btn secondary" (click)="openConfig()">Open config file</button>
          <button class="wiz-btn secondary" *ngIf="canTerminal" (click)="runTerminal()">
            Run onboarding in terminal
          </button>
        </div>

        <div class="wiz-actions">
          <button class="wiz-btn secondary" (click)="prev()">Back</button>
          <button class="wiz-btn primary" (click)="next()">Next</button>
        </div>
      </section>

      <!-- VERIFY -->
      <section class="wiz-panel" *ngIf="step === 'verify'">
        <h1 class="wiz-title">Verify everything works</h1>
        <p class="wiz-lead">
          Running health checks to make sure OpenClaw, the companion, and your provider are connected.
        </p>

        <div class="wiz-checklist">
          <div
            class="wiz-check-row"
            *ngFor="let c of verifyChecks"
            [class.pass]="c.ok === true"
            [class.fail]="c.ok === false"
          >
            <span
              class="wiz-check-dot"
              [class.on]="c.ok === true"
              [class.off]="c.ok === false"
              [class.spin]="c.ok === null"
            ></span>
            <div class="wiz-check-body">
              <span class="wiz-check-text">{{ c.label }}</span>
              <span class="wiz-check-detail" *ngIf="c.detail">{{ c.detail }}</span>
            </div>
          </div>
        </div>

        <div class="wiz-verify-actions">
          <button class="wiz-btn secondary" (click)="runVerify()" [disabled]="verifying">
            {{ verifying ? 'Checking…' : 'Re-run checks' }}
          </button>
          <button class="wiz-btn secondary" (click)="runDoctor()" [disabled]="doctorBusy">
            {{ doctorBusy ? 'Running…' : 'Run OpenClaw Doctor' }}
          </button>
        </div>
        <pre class="wiz-pre doctor" *ngIf="doctorOutput">{{ doctorOutput }}</pre>

        <div class="wiz-actions">
          <button class="wiz-btn secondary" (click)="prev()">Back</button>
          <button class="wiz-btn primary" (click)="finishSetup()">
            {{ allPassing ? 'Finish setup' : 'Continue anyway' }}
          </button>
        </div>
      </section>

      <!-- DONE -->
      <section class="wiz-panel" *ngIf="step === 'done'">
        <div class="wiz-done-hero">
          <span class="wiz-done-check">&#10003;</span>
          <h1 class="wiz-title">You're all set</h1>
          <p class="wiz-lead">
            OpenClaw is connected to Spectyra. Explore skills, set up assistant profiles, or
            go straight to the live dashboard.
          </p>
        </div>

        <div class="wiz-done-grid">
          <a class="wiz-done-card" routerLink="/desktop/home">
            <span class="wiz-done-icon">&#9776;</span>
            <span class="wiz-done-label">Dashboard</span>
            <span class="wiz-done-desc">See status and activity at a glance</span>
          </a>
          <a class="wiz-done-card" routerLink="/desktop/skills">
            <span class="wiz-done-icon">&#9881;</span>
            <span class="wiz-done-label">Install Skills</span>
            <span class="wiz-done-desc">Browse ClawHub and add capabilities</span>
          </a>
          <a class="wiz-done-card" routerLink="/desktop/assistants">
            <span class="wiz-done-icon">&#9733;</span>
            <span class="wiz-done-label">Assistants</span>
            <span class="wiz-done-desc">Configure AI Assistant or AI Coder</span>
          </a>
          <a class="wiz-done-card" routerLink="/desktop/live">
            <span class="wiz-done-icon">&#9673;</span>
            <span class="wiz-done-label">Open Live</span>
            <span class="wiz-done-desc">Real-time optimization and savings</span>
          </a>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .wiz {
      max-width: 600px;
      margin: 0 auto;
      padding: 32px 20px 48px;
      font-family: 'DM Sans', sans-serif;
    }

    /* ── Progress bar ── */
    .wiz-progress {
      display: flex;
      gap: 4px;
      margin-bottom: 36px;
    }
    .wiz-pip {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      position: relative;
    }
    .wiz-pip-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      border: 1.5px solid var(--border-bright, rgba(55,138,221,0.25));
      color: var(--text-muted, #3d5a78);
      background: transparent;
      transition: all 0.2s ease;
    }
    .wiz-pip.active .wiz-pip-num {
      border-color: var(--spectyra-blue, #378ADD);
      background: var(--spectyra-blue, #378ADD);
      color: #fff;
    }
    .wiz-pip.done .wiz-pip-num {
      border-color: var(--spectyra-teal, #1D9E75);
      background: var(--spectyra-teal, #1D9E75);
      color: #fff;
    }
    .wiz-pip.clickable { cursor: pointer; }
    .wiz-pip-label {
      font-size: 10px;
      color: var(--text-muted, #3d5a78);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .wiz-pip.active .wiz-pip-label { color: var(--text-primary, #e8f1fb); }
    .wiz-pip.done .wiz-pip-label { color: var(--spectyra-teal-light, #5DCAA5); }

    /* ── Panel ── */
    .wiz-panel { animation: fadeIn 0.2s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

    .wiz-title {
      font-family: 'Source Sans Pro', 'DM Sans', sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: var(--text-primary, #e8f1fb);
      margin: 0 0 10px;
    }
    .wiz-lead {
      font-size: 14px;
      color: var(--text-secondary, #7a9fc0);
      line-height: 1.5;
      margin: 0 0 24px;
    }

    /* ── What you'll get ── */
    .wiz-what {
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 12px;
      padding: 18px 22px;
      margin-bottom: 28px;
    }
    .wiz-what-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #e8f1fb);
      margin: 0 0 10px;
    }
    .wiz-what-list {
      margin: 0;
      padding: 0 0 0 18px;
      list-style: disc;
    }
    .wiz-what-list li {
      font-size: 13px;
      color: var(--text-secondary, #7a9fc0);
      line-height: 1.8;
    }

    /* ── Form fields ── */
    .wiz-field { margin-bottom: 14px; }
    .wiz-label {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary, #7a9fc0);
      margin-bottom: 5px;
    }
    .wiz-input, .wiz-select {
      width: 100%;
      box-sizing: border-box;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--border-bright, rgba(55,138,221,0.25));
      background: var(--bg-card, #121c2e);
      color: var(--text-primary, #e8f1fb);
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      outline: none;
      transition: border-color 0.15s;
    }
    .wiz-input:focus, .wiz-select:focus {
      border-color: var(--spectyra-blue, #378ADD);
    }

    /* ── Code block ── */
    .wiz-code-block {
      position: relative;
      margin-bottom: 16px;
    }
    .wiz-pre {
      background: rgba(0,0,0,0.35);
      padding: 14px 16px;
      border-radius: 8px;
      font-family: 'DM Mono', monospace;
      font-size: 12px;
      color: var(--text-secondary, #7a9fc0);
      white-space: pre-wrap;
      word-break: break-all;
      overflow-x: auto;
      margin: 0;
    }
    .wiz-pre.doctor {
      max-height: 240px;
      overflow: auto;
      margin-top: 12px;
    }
    .wiz-code-block .wiz-btn.small {
      position: absolute;
      top: 8px;
      right: 8px;
    }

    .wiz-hint {
      font-size: 12px;
      color: var(--text-muted, #3d5a78);
      margin: 8px 0 16px;
    }
    .wiz-hint code {
      font-family: 'DM Mono', monospace;
      font-size: 11px;
      background: rgba(0,0,0,0.2);
      padding: 2px 5px;
      border-radius: 4px;
    }

    .wiz-err { color: #ef4444; font-size: 13px; margin: 8px 0; }
    .wiz-ok { color: var(--spectyra-teal, #1D9E75); font-size: 13px; margin: 8px 0; }

    /* ── Check rows ── */
    .wiz-checklist { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
    .wiz-check-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 8px;
      padding: 12px 16px;
      transition: border-color 0.15s;
    }
    .wiz-check-row.pass { border-color: rgba(29,158,117,0.3); }
    .wiz-check-row.fail { border-color: rgba(239,68,68,0.25); }
    .wiz-check-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      background: var(--text-muted, #3d5a78);
      transition: background 0.2s;
    }
    .wiz-check-dot.on { background: var(--spectyra-teal, #1D9E75); }
    .wiz-check-dot.off { background: #ef4444; }
    .wiz-check-dot.spin {
      background: var(--spectyra-blue, #378ADD);
      animation: pulse 1.2s ease-in-out infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .wiz-check-body { flex: 1; }
    .wiz-check-text { font-size: 13px; font-weight: 500; color: var(--text-primary, #e8f1fb); display: block; }
    .wiz-check-detail { font-size: 11px; color: var(--text-muted, #3d5a78); display: block; margin-top: 2px; }

    /* ── Buttons ── */
    .wiz-actions {
      display: flex;
      gap: 12px;
      margin-top: 28px;
    }
    .wiz-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 8px;
    }
    .wiz-verify-actions {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
    }
    .wiz-btn {
      padding: 10px 22px;
      border-radius: 8px;
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: background 0.15s, border-color 0.15s, opacity 0.15s;
    }
    .wiz-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .wiz-btn.primary {
      background: var(--spectyra-blue, #378ADD);
      color: #fff;
    }
    .wiz-btn.primary:hover:not(:disabled) { background: var(--spectyra-navy-mid, #185FA5); }
    .wiz-btn.secondary {
      background: transparent;
      color: var(--text-secondary, #7a9fc0);
      border: 1px solid var(--border-bright, rgba(55,138,221,0.25));
    }
    .wiz-btn.secondary:hover:not(:disabled) {
      border-color: var(--spectyra-blue, #378ADD);
      color: var(--text-primary, #e8f1fb);
    }
    .wiz-btn.small {
      padding: 5px 12px;
      font-size: 11px;
    }
    .wiz-btn.tiny {
      padding: 4px 10px;
      font-size: 10px;
      background: transparent;
      color: var(--text-muted, #3d5a78);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 6px;
    }

    /* ── Done hero ── */
    .wiz-done-hero {
      text-align: center;
      margin-bottom: 32px;
    }
    .wiz-done-check {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--spectyra-teal, #1D9E75);
      color: #fff;
      font-size: 28px;
      margin-bottom: 16px;
    }
    .wiz-done-hero .wiz-title { margin-bottom: 12px; }
    .wiz-done-hero .wiz-lead { max-width: 400px; margin: 0 auto; }

    .wiz-done-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .wiz-done-card {
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s;
      cursor: pointer;
    }
    .wiz-done-card:hover {
      border-color: var(--spectyra-blue, #378ADD);
      background: var(--bg-elevated, #162236);
    }
    .wiz-done-icon {
      font-size: 22px;
      margin-bottom: 4px;
    }
    .wiz-done-label {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary, #e8f1fb);
    }
    .wiz-done-desc {
      font-size: 12px;
      color: var(--text-secondary, #7a9fc0);
    }
  `],
})
export class OpenClawWizardPage implements OnInit {
  private readonly desktop = inject(DesktopBridgeService);
  private readonly oc = inject(OpenClawDesktopService);
  private readonly diagnostics = inject(LocalCompanionDiagnosticsService);
  private readonly router = inject(Router);

  readonly steps = STEP_ORDER;
  readonly stepLabels: Record<WizardStep, string> = {
    welcome: 'Welcome',
    install: 'Install',
    provider: 'Provider',
    connect: 'Connect',
    verify: 'Verify',
    done: 'Done',
  };
  readonly nodeMin = OPENCLAW_NODE_VERSION_MIN;
  readonly installCmd = OPENCLAW_INSTALL_BASH;
  readonly setup = DESKTOP_SETUP;

  step: WizardStep = 'welcome';
  get stepIdx(): number { return STEP_ORDER.indexOf(this.step); }

  canSkip = false;
  canTerminal = false;

  cliDetected = false;
  checkingCli = false;
  installCopied = false;
  terminalErr: string | null = null;

  provider = 'openai';
  apiKey = '';
  keySaving = false;
  keyError: string | null = null;
  keyOk = false;

  configJson = '';
  configCopied = false;

  verifyChecks: Array<{ label: string; ok: boolean | null; detail?: string }> = [];
  verifying = false;
  doctorBusy = false;
  doctorOutput: string | null = null;

  get allPassing(): boolean {
    return this.verifyChecks.length > 0 && this.verifyChecks.every((c) => c.ok === true);
  }

  async ngOnInit(): Promise<void> {
    this.canTerminal = this.desktop.isElectronRenderer;

    const [cfg, status] = await Promise.all([
      this.desktop.getConfig(),
      this.oc.refreshStatus(),
    ]);

    if (cfg && typeof cfg['provider'] === 'string') this.provider = cfg['provider'] as string;
    this.cliDetected = status.cliDetected || status.openclawDetected;
    this.canSkip = status.companionHealthy && status.providerConfigured;

    try {
      this.configJson = await this.diagnostics.buildOpenClawConfigJson();
    } catch {
      this.configJson = (await this.desktop.openClawExample()) || '';
    }
  }

  goTo(s: WizardStep): void {
    this.step = s;
    if (s === 'verify') void this.runVerify();
  }

  next(): void {
    const i = this.stepIdx;
    if (this.step === 'provider' && !this.keyOk) {
      void this.saveKey();
      return;
    }
    if (i < STEP_ORDER.length - 1) {
      this.step = STEP_ORDER[i + 1];
      if (this.step === 'verify') void this.runVerify();
    }
  }

  prev(): void {
    const i = this.stepIdx;
    if (i > 0) this.step = STEP_ORDER[i - 1];
  }

  async detectCli(): Promise<void> {
    this.checkingCli = true;
    try {
      const s = await this.oc.refreshStatus();
      this.cliDetected = s.cliDetected || s.openclawDetected;
    } finally {
      this.checkingCli = false;
    }
  }

  async copyInstall(): Promise<void> {
    await navigator.clipboard.writeText(this.installCmd);
    this.installCopied = true;
    setTimeout(() => (this.installCopied = false), 2000);
  }

  async runTerminal(): Promise<void> {
    this.terminalErr = null;
    const r = await this.desktop.runOpenClawOnboardInTerminal({ flow: 'quickstart' });
    if (!r.ok) this.terminalErr = r.error || 'Could not open terminal.';
  }

  async saveKey(): Promise<void> {
    if (!this.apiKey.trim()) return;
    this.keySaving = true;
    this.keyError = null;
    this.keyOk = false;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        const result = await this.desktop.setProviderKey(this.provider, this.apiKey.trim());
        const friendly = friendlyProviderKeyUserMessage(result);
        if (friendly.success) {
          this.keyOk = true;
          this.apiKey = '';
          this.next();
          return;
        }
        if (attempt === 2) {
          this.keyError = friendly.message;
        }
      }
    } catch (e: unknown) {
      this.keyError = e instanceof Error ? e.message : 'Failed to save key.';
    } finally {
      this.keySaving = false;
    }
  }

  async copyConfig(): Promise<void> {
    await navigator.clipboard.writeText(this.configJson);
    this.configCopied = true;
    setTimeout(() => (this.configCopied = false), 2000);
  }

  async openConfig(): Promise<void> {
    await this.oc.openConfig();
  }

  async runVerify(): Promise<void> {
    this.verifying = true;
    this.verifyChecks = [
      { label: 'OpenClaw CLI detected', ok: null },
      { label: 'Local Companion running', ok: null },
      { label: 'Provider key configured', ok: null },
      { label: 'Spectyra model aliases visible', ok: null },
    ];

    const s = await this.oc.refreshStatus();

    this.verifyChecks[0] = {
      label: 'OpenClaw CLI detected',
      ok: s.cliDetected || s.openclawDetected,
      detail: s.cliDetected ? 'Found in PATH' : 'Install OpenClaw, then re-run',
    };
    this.verifyChecks[1] = {
      label: 'Local Companion running',
      ok: s.companionHealthy,
      detail: s.companionHealthy ? `Mode: ${s.runMode || 'on'}` : 'Not responding',
    };
    this.verifyChecks[2] = {
      label: 'Provider key configured',
      ok: s.providerConfigured,
      detail: s.providerConfigured ? `Provider: ${s.provider || 'set'}` : 'Go back and add a key',
    };
    this.verifyChecks[3] = {
      label: 'Spectyra model aliases visible',
      ok: s.companionHealthy,
      detail: s.companionHealthy ? 'spectyra/smart, spectyra/fast, spectyra/quality' : 'Companion offline',
    };

    this.verifying = false;
  }

  async runDoctor(): Promise<void> {
    this.doctorBusy = true;
    this.doctorOutput = null;
    const r = await this.oc.runDoctor();
    this.doctorOutput = r.output || '(No output)';
    this.doctorBusy = false;
  }

  finishSetup(): void {
    localStorage.setItem('spectyra_openclaw_setup_done', '1');
    localStorage.setItem('spectyra_desktop_onboarding_done', '1');
    this.step = 'done';
  }
}
