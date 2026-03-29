import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import {
  AgentCompanionService,
  RUNTIME_OPTIONS,
  type RuntimeType,
  type ConnectionStyle,
  type WizardStep,
  type RuntimeOption,
  type ValidationCheck,
} from '../../../core/agent-companion/agent-companion.service';

@Component({
  selector: 'app-agent-companion-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="wizard">
      <!-- Progress bar -->
      <div class="wizard-progress">
        <div class="wp-track">
          <div class="wp-fill" [style.width]="progressPct + '%'"></div>
        </div>
        <div class="wp-steps">
          <span class="wp-step" *ngFor="let s of stepLabels; let i = index"
                [class.active]="i <= currentStepIndex"
                [class.current]="i === currentStepIndex">
            {{ s }}
          </span>
        </div>
      </div>

      <!-- Step 1: Select Runtime -->
      <div class="step" *ngIf="svc.state.step === 'select-runtime'">
        <h1 class="step-title">Choose your agent runtime</h1>
        <p class="step-sub">What environment is your AI agent running in? Pick the best match.</p>
        <div class="runtime-grid">
          <button class="runtime-card" *ngFor="let rt of runtimeOptions"
                  (click)="selectRuntime(rt.type)"
                  [class.selected]="svc.state.runtime === rt.type">
            <span class="rc-icon material-icons">{{ rt.icon }}</span>
            <span class="rc-label">{{ rt.label }}</span>
            <span class="rc-desc">{{ rt.description }}</span>
          </button>
        </div>
      </div>

      <!-- Step 2: New vs Existing -->
      <div class="step" *ngIf="svc.state.step === 'select-path'">
        <button class="back-btn" (click)="goBack('select-runtime')">← Back</button>
        <h1 class="step-title">{{ selectedRuntime?.label }} — new or existing?</h1>
        <p class="step-sub">Tell us where you are so we can guide you through the right setup.</p>
        <div class="path-grid">
          <button class="path-card" (click)="selectPath('new')">
            <span class="material-icons pc-icon">add_circle_outline</span>
            <span class="pc-label">New setup</span>
            <span class="pc-desc">I haven't set up {{ selectedRuntime?.label }} yet. Guide me from the start.</span>
          </button>
          <button class="path-card" (click)="selectPath('existing')">
            <span class="material-icons pc-icon">link</span>
            <span class="pc-label">Connect existing</span>
            <span class="pc-desc">{{ selectedRuntime?.label }} is already running. Attach Spectyra to it.</span>
          </button>
        </div>
      </div>

      <!-- Step 3: Connection Style -->
      <div class="step" *ngIf="svc.state.step === 'select-connection'">
        <button class="back-btn" (click)="goBack('select-path')">← Back</button>
        <h1 class="step-title">How should Spectyra connect?</h1>
        <p class="step-sub">Choose the connection style for {{ selectedRuntime?.label }}.</p>
        <div class="conn-grid">
          <button class="conn-card" *ngFor="let cs of availableConnections"
                  (click)="selectConnection(cs)">
            <span class="cc-label">{{ connectionLabel(cs).label }}</span>
            <span class="cc-desc">{{ connectionLabel(cs).description }}</span>
          </button>
        </div>
      </div>

      <!-- Step 4: Configure (runtime-specific) -->
      <div class="step" *ngIf="svc.state.step === 'configure'">
        <button class="back-btn" (click)="goBack('select-connection')">← Back</button>
        <h1 class="step-title">Configure {{ selectedRuntime?.label }}</h1>

        <div class="config-section" *ngIf="svc.state.runtime === 'openclaw'">
          <p class="step-sub">Follow the OpenClaw-specific wizard for detailed setup.</p>
          <button class="btn-primary" routerLink="/desktop/openclaw">Open OpenClaw wizard</button>
        </div>

        <div class="config-section" *ngIf="svc.state.runtime === 'claude'">
          <h2 class="config-h2">Claude runtime setup</h2>
          <ol class="config-steps">
            <li>Ensure Claude Code or your Claude-hooks agent is running.</li>
            <li>Start the Spectyra Local Companion (it should already be running).</li>
            <li>
              Configure Claude hooks to POST events to
              <code>{{ svc.state.companionOrigin || 'http://127.0.0.1:4111' }}/v1/analytics/ingest</code>
            </li>
            <li>Events will appear in the Live dashboard automatically.</li>
          </ol>
          <div class="config-code">
            <span class="code-label">Ingest endpoint</span>
            <pre class="code-block">{{ svc.state.companionOrigin || 'http://127.0.0.1:4111' }}/v1/analytics/ingest</pre>
            <button class="btn-copy" (click)="copyText((svc.state.companionOrigin || 'http://127.0.0.1:4111') + '/v1/analytics/ingest')">Copy</button>
          </div>
          <button class="btn-primary" (click)="svc.goToStep('validate'); svc.runValidation()">Validate connection</button>
        </div>

        <div class="config-section" *ngIf="svc.state.runtime === 'openai'">
          <h2 class="config-h2">OpenAI Agents setup</h2>
          <ol class="config-steps">
            <li>Install or update your OpenAI Agents SDK project.</li>
            <li>Configure the tracing processor to POST spans to the Spectyra companion.</li>
            <li>
              Tracing endpoint:
              <code>{{ svc.state.companionOrigin || 'http://127.0.0.1:4111' }}/v1/analytics/ingest</code>
            </li>
            <li>Run your agent — spans will appear in the Live dashboard.</li>
          </ol>
          <button class="btn-primary" (click)="svc.goToStep('validate'); svc.runValidation()">Validate connection</button>
        </div>

        <div class="config-section" *ngIf="svc.state.runtime === 'sdk'">
          <h2 class="config-h2">SDK integration</h2>
          <ol class="config-steps">
            <li>Install: <code>npm install &#64;spectyra/sdk</code></li>
            <li>Wrap your LLM calls with the Spectyra SDK client.</li>
            <li>The SDK connects to the Local Companion automatically.</li>
          </ol>
          <div class="config-code">
            <span class="code-label">Quick start</span>
            <pre class="code-block">import {{ '{' }} Spectyra {{ '}' }} from '&#64;spectyra/sdk';
const spectyra = new Spectyra();
const result = await spectyra.optimize(messages);</pre>
          </div>
          <button class="btn-primary" (click)="svc.goToStep('validate'); svc.runValidation()">Validate connection</button>
        </div>

        <div class="config-section" *ngIf="svc.state.runtime === 'generic-endpoint'">
          <h2 class="config-h2">Generic endpoint</h2>
          <ol class="config-steps">
            <li>Point your LLM tool's API base URL to the Spectyra Local Companion.</li>
            <li>
              Base URL: <code>{{ svc.state.companionOrigin || 'http://127.0.0.1:4111' }}/v1</code>
            </li>
            <li>The companion exposes OpenAI-compatible and Anthropic-compatible endpoints.</li>
          </ol>
          <div class="config-code">
            <span class="code-label">API base URL</span>
            <pre class="code-block">{{ svc.state.companionOrigin || 'http://127.0.0.1:4111' }}/v1</pre>
            <button class="btn-copy" (click)="copyText((svc.state.companionOrigin || 'http://127.0.0.1:4111') + '/v1')">Copy</button>
          </div>
          <button class="btn-primary" (click)="svc.goToStep('validate'); svc.runValidation()">Validate connection</button>
        </div>

        <div class="config-section" *ngIf="svc.state.runtime === 'logs-traces'">
          <h2 class="config-h2">Logs / traces attach</h2>
          <ol class="config-steps">
            <li>Identify your log or trace output (JSONL, structured JSON, tracing spans).</li>
            <li>Configure a log tailer or sidecar to POST records to the ingest endpoint.</li>
            <li>
              Ingest: <code>{{ svc.state.companionOrigin || 'http://127.0.0.1:4111' }}/v1/analytics/ingest</code>
            </li>
            <li>Records that match a known adapter shape will be normalized automatically.</li>
          </ol>
          <button class="btn-primary" (click)="svc.goToStep('validate'); svc.runValidation()">Validate connection</button>
        </div>
      </div>

      <!-- Step 5: Validate -->
      <div class="step" *ngIf="svc.state.step === 'validate'">
        <button class="back-btn" (click)="goBack('configure')">← Back</button>
        <h1 class="step-title">Validating connection</h1>
        <p class="step-sub">Checking that the Local Companion is reachable and configured.</p>

        <div class="checks-list">
          <div class="check-row" *ngFor="let c of svc.state.checks">
            <span class="check-icon" [ngClass]="'check-' + c.status">
              <span *ngIf="c.status === 'pass'">✓</span>
              <span *ngIf="c.status === 'fail'">✗</span>
              <span *ngIf="c.status === 'checking'" class="check-spin">◌</span>
              <span *ngIf="c.status === 'pending'">○</span>
              <span *ngIf="c.status === 'skip'">—</span>
            </span>
            <div class="check-body">
              <span class="check-label">{{ c.label }}</span>
              <span class="check-detail" *ngIf="c.detail">{{ c.detail }}</span>
            </div>
          </div>
        </div>

        <div class="validate-actions">
          <button class="btn-secondary" (click)="svc.runValidation()">Re-check</button>
          <button class="btn-primary" *ngIf="svc.criticalChecksPassed()" (click)="goLive()">
            Go live →
          </button>
        </div>

        <div class="troubleshoot" *ngIf="!svc.state.companionHealthy">
          <h3 class="ts-title">Troubleshooting</h3>
          <ul class="ts-list">
            <li>Ensure the Spectyra desktop app is running (the companion starts automatically).</li>
            <li>Check that nothing else is using port 4111.</li>
            <li>Try restarting the desktop app.</li>
            <li *ngIf="svc.state.runtime === 'openclaw'">
              Run <code>openclaw doctor</code> to check OpenClaw health.
            </li>
          </ul>
        </div>
      </div>

      <!-- Step 6: Go Live handoff -->
      <div class="step" *ngIf="svc.state.step === 'go-live'">
        <div class="go-live-card">
          <span class="gl-dot"></span>
          <h1 class="gl-title">You're live</h1>
          <p class="gl-sub">
            {{ selectedRuntime?.label }} is connected via {{ svc.state.connectionStyle }}.
            Head to the Live dashboard to monitor your agent in real time.
          </p>
          <button class="btn-primary" (click)="navigateToLive()">Open Live dashboard</button>
          <p class="gl-hint">
            Your agent continues to work normally. Spectyra runs alongside — never blocking your provider calls.
          </p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .wizard {
        max-width: 820px;
        margin: 0 auto;
        padding: 24px 20px 48px;
        font-family: var(--font-body);
      }

      /* ── Progress ── */
      .wizard-progress {
        margin-bottom: 32px;
      }

      .wp-track {
        height: 2px;
        background: var(--border);
        border-radius: 2px;
        overflow: hidden;
        margin-bottom: 10px;
      }

      .wp-fill {
        height: 100%;
        background: var(--spectyra-blue);
        transition: width 300ms ease;
      }

      .wp-steps {
        display: flex;
        gap: 16px;
        font-size: 11px;
        color: var(--text-muted);
      }

      .wp-step.active { color: var(--text-secondary); }
      .wp-step.current { color: var(--spectyra-blue); font-weight: 500; }

      /* ── Step layout ── */
      .step { animation: stepFade 200ms ease-out; }

      .step-title {
        margin: 0 0 8px;
        font-family: var(--font-display);
        font-size: 1.4rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .step-sub {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 24px;
      }

      .back-btn {
        background: none;
        border: none;
        color: var(--text-muted);
        font-family: var(--font-body);
        font-size: 12px;
        cursor: pointer;
        padding: 0;
        margin-bottom: 16px;
        display: block;

        &:hover { color: var(--text-secondary); }
      }

      /* ── Runtime grid ── */
      .runtime-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 12px;
      }

      .runtime-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 16px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s ease;

        &:hover { border-color: var(--border-bright); }
        &.selected { border-color: var(--spectyra-blue); }
      }

      .rc-icon {
        font-size: 20px;
        color: var(--spectyra-blue);
      }

      .rc-label {
        font-family: var(--font-body);
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .rc-desc {
        font-size: 12px;
        color: var(--text-secondary);
        line-height: 1.45;
      }

      /* ── Path grid ── */
      .path-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
      }

      .path-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 24px 20px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        cursor: pointer;
        text-align: center;
        transition: border-color 0.15s ease;

        &:hover { border-color: var(--spectyra-blue); }
      }

      .pc-icon { font-size: 28px; color: var(--spectyra-blue); }
      .pc-label { font-size: 14px; font-weight: 500; color: var(--text-primary); }
      .pc-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.4; }

      /* ── Connection grid ── */
      .conn-grid {
        display: grid;
        gap: 12px;
      }

      .conn-card {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 16px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        cursor: pointer;
        text-align: left;
        transition: border-color 0.15s ease;

        &:hover { border-color: var(--spectyra-blue); }
      }

      .cc-label { font-size: 13px; font-weight: 500; color: var(--text-primary); }
      .cc-desc { font-size: 12px; color: var(--text-secondary); }

      /* ── Configure ── */
      .config-section { margin-top: 8px; }

      .config-h2 {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
        margin: 0 0 12px;
      }

      .config-steps {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.7;
        padding-left: 1.2rem;
        margin: 0 0 16px;
      }

      .config-steps code {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        background: var(--bg-elevated);
        color: var(--spectyra-blue-light);
      }

      .config-code {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
        padding: 12px 14px;
        margin-bottom: 16px;
        position: relative;
      }

      .code-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-muted);
        display: block;
        margin-bottom: 6px;
      }

      .code-block {
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--text-primary);
        margin: 0;
        white-space: pre-wrap;
        word-break: break-all;
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

      /* ── Validate ── */
      .checks-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 20px;
      }

      .check-row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 14px;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-input);
      }

      .check-icon {
        font-size: 14px;
        min-width: 18px;
        text-align: center;
        margin-top: 1px;
      }

      .check-pass { color: var(--spectyra-teal); }
      .check-fail { color: var(--color-danger); }
      .check-checking { color: var(--spectyra-blue); }
      .check-pending { color: var(--text-muted); }
      .check-skip { color: var(--text-muted); }

      .check-spin { animation: spin 1s linear infinite; display: inline-block; }

      .check-body {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .check-label { font-size: 13px; color: var(--text-primary); }
      .check-detail { font-size: 11px; color: var(--text-secondary); }

      .validate-actions {
        display: flex;
        gap: 10px;
        margin-bottom: 24px;
      }

      .troubleshoot {
        background: var(--bg-card);
        border: 1px solid var(--spectyra-amber-border);
        border-radius: var(--radius-input);
        padding: 14px 16px;
      }

      .ts-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--spectyra-amber-light);
        margin: 0 0 8px;
      }

      .ts-list {
        color: var(--text-secondary);
        font-size: 12px;
        line-height: 1.7;
        padding-left: 1.2rem;
        margin: 0;
      }

      .ts-list code {
        font-family: var(--font-mono);
        font-size: 11px;
        padding: 1px 5px;
        border-radius: 3px;
        background: var(--bg-elevated);
        color: var(--spectyra-blue-light);
      }

      /* ── Go Live ── */
      .go-live-card {
        text-align: center;
        padding: 40px 24px;
      }

      .gl-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--spectyra-teal);
        animation: pulse 2s ease-in-out infinite;
        margin-bottom: 16px;
      }

      .gl-title {
        font-family: var(--font-display);
        font-size: 1.6rem;
        font-weight: 700;
        color: var(--text-primary);
        margin: 0 0 10px;
      }

      .gl-sub {
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.5;
        margin-bottom: 20px;
      }

      .gl-hint {
        color: var(--text-muted);
        font-size: 11px;
        margin-top: 16px;
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

      @keyframes stepFade {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
    `,
  ],
})
export class AgentCompanionLandingPage implements OnInit {
  readonly stepLabels = ['Runtime', 'Path', 'Connection', 'Configure', 'Validate', 'Go live'];
  readonly runtimeOptions = RUNTIME_OPTIONS;

  constructor(
    public svc: AgentCompanionService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.svc.reset();
  }

  get selectedRuntime(): RuntimeOption | null {
    return this.svc.selectedRuntime();
  }

  get currentStepIndex(): number {
    const map: Record<WizardStep, number> = {
      'select-runtime': 0,
      'select-path': 1,
      'select-connection': 2,
      'configure': 3,
      'validate': 4,
      'go-live': 5,
    };
    return map[this.svc.state.step] ?? 0;
  }

  get progressPct(): number {
    return ((this.currentStepIndex + 1) / this.stepLabels.length) * 100;
  }

  get availableConnections(): ConnectionStyle[] {
    return this.selectedRuntime?.connectionStyles ?? [];
  }

  selectRuntime(type: RuntimeType) {
    this.svc.selectRuntime(type);
  }

  selectPath(path: 'new' | 'existing') {
    this.svc.selectPath(path);
  }

  selectConnection(style: ConnectionStyle) {
    this.svc.selectConnection(style);
    if (this.svc.state.runtime === 'openclaw' && style !== 'observe') {
      this.svc.goToStep('configure');
    }
  }

  connectionLabel(style: ConnectionStyle) {
    return this.svc.connectionLabel(style);
  }

  goBack(step: WizardStep) {
    this.svc.goToStep(step);
  }

  goLive() {
    this.svc.goToStep('go-live');
  }

  navigateToLive() {
    this.router.navigateByUrl('/desktop/live');
  }

  async copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }
}
