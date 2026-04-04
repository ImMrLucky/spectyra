import { Component, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  AgentCompanionService,
  RUNTIME_OPTIONS,
  type RuntimeType,
  type ConnectionStyle,
  type WizardStep,
  type RuntimeOption,
  type ValidationCheck,
} from '../../../core/agent-companion/agent-companion.service';
import { DesktopFirstRunService } from '../../../core/desktop/desktop-first-run.service';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';
import { DESKTOP_SETUP, friendlyProviderKeyUserMessage } from '../../../core/desktop/desktop-setup-messages';
import { IntegrationOnboardingService } from '../../integrations/services/integration-onboarding.service';
import { buildChecklistItems } from '../../integrations/services/map-onboarding-state';
import { SupabaseService } from '../../../services/supabase.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MeService } from '../../../core/services/me.service';

@Component({
  selector: 'app-agent-companion-landing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="wizard">
      <!-- First launch: orient users before the runtime wizard -->
      <div class="ac-welcome" *ngIf="showFirstRunWelcome">
        <div class="ac-welcome-inner">
          <div class="ac-welcome-copy">
            <h2 class="ac-welcome-title">Welcome to Spectyra</h2>
            <p class="ac-welcome-text">
              <strong>Agent Companion</strong> is the right place to start: pick your agent runtime (OpenClaw, Claude, OpenAI, SDK, …),
              connect the Local Companion, then open <strong>Live</strong> to monitor sessions in real time.
            </p>
          </div>
          <div class="ac-welcome-actions">
            <button type="button" class="btn-primary" (click)="continueToLiveDashboard()">
              Continue to Live dashboard
            </button>
            <span class="ac-welcome-hint">or follow the steps below</span>
          </div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="wizard-progress">
        <div class="wp-track">
          <div class="wp-fill" [style.width]="progressPct + '%'"></div>
        </div>
        <div class="wp-steps">
          <span class="wp-step" *ngFor="let s of wizardStepLabels; let i = index"
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

      <!-- Step 3: Connection Style (not used for OpenClaw — new/existing picks the path there) -->
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
        <button class="back-btn" (click)="configureBack()">← Back</button>
        <h1 class="step-title">Configure {{ selectedRuntime?.label }}</h1>

        <div class="config-section" *ngIf="svc.state.runtime === 'openclaw'">
          <p class="step-sub">
            Finish each step in order: add your provider key here, point OpenClaw at the Local Companion (copy config if needed),
            then tap <strong>Continue</strong> when the checklist is green. After validation, open <strong>Live</strong> to watch runs and savings.
          </p>

          <!-- Readiness checklist -->
          <div class="oc-checklist">
            <div class="oc-check-row" *ngFor="let item of openclawChecklist()">
              <span class="oc-check-icon" [ngClass]="'oc-' + item.status">
                <span *ngIf="item.status === 'success'">✓</span>
                <span *ngIf="item.status === 'failure'">✗</span>
                <span *ngIf="item.status === 'pending'">○</span>
              </span>
              <span class="oc-check-label">{{ item.label }}</span>
            </div>
          </div>

          <!-- Inline sign-in / sign-up when not signed in -->
          <div class="oc-auth-card" *ngIf="onboarding.status().state === 'not_signed_in'">
            <h3 class="oc-auth-title">{{ ocAuthMode === 'login' ? 'Sign in to Spectyra' : 'Create a Spectyra account' }}</h3>
            <p class="oc-auth-desc">
              {{ ocAuthMode === 'login'
                ? 'Sign in to sync sessions to the cloud dashboard and see analytics.'
                : 'Create a free account to sync sessions and unlock analytics.' }}
            </p>
            <form class="oc-auth-form" (ngSubmit)="ocAuthMode === 'login' ? ocDoSignIn() : ocDoSignUp()">
              <div class="oc-field">
                <label for="oc-email">Email</label>
                <input id="oc-email" type="email" [(ngModel)]="ocAuthEmail" name="email"
                       placeholder="you@example.com" [disabled]="ocAuthLoading" required />
              </div>
              <div class="oc-field">
                <label for="oc-pass">Password</label>
                <input id="oc-pass" type="password" [(ngModel)]="ocAuthPassword" name="password"
                       placeholder="••••••••" [disabled]="ocAuthLoading" required minlength="8" />
              </div>
              <div class="oc-field" *ngIf="ocAuthMode === 'register'">
                <label for="oc-org">Organization name</label>
                <input id="oc-org" type="text" [(ngModel)]="ocAuthOrgName" name="orgName"
                       placeholder="My Company" [disabled]="ocAuthLoading" required />
              </div>
              <div class="oc-auth-error" *ngIf="ocAuthError">{{ ocAuthError }}</div>
              <button type="submit" class="btn-primary"
                      [disabled]="ocAuthLoading || !ocAuthEmail || !ocAuthPassword || (ocAuthMode === 'register' && !ocAuthOrgName)">
                {{ ocAuthLoading
                  ? (ocAuthMode === 'login' ? 'Signing in…' : 'Creating account…')
                  : (ocAuthMode === 'login' ? 'Sign in' : 'Create account') }}
              </button>
            </form>
            <p class="oc-auth-toggle">
              <ng-container *ngIf="ocAuthMode === 'login'">
                No account? <button type="button" class="oc-link-btn" (click)="ocAuthMode = 'register'; ocAuthError = null">Sign up</button>
              </ng-container>
              <ng-container *ngIf="ocAuthMode === 'register'">
                Have an account? <button type="button" class="oc-link-btn" (click)="ocAuthMode = 'login'; ocAuthError = null">Sign in</button>
              </ng-container>
            </p>
          </div>

          <!-- Inline provider key setup -->
          <div class="oc-auth-card" *ngIf="onboarding.status().state === 'provider_missing'">
            <h3 class="oc-auth-title">Add your AI key</h3>
            <p class="oc-auth-desc">
              Paste your OpenAI, Anthropic, or Groq key. It never leaves this computer.
            </p>
            <form class="oc-auth-form" (ngSubmit)="saveProviderKey()">
              <div class="oc-field">
                <label for="oc-provider">Provider</label>
                <select id="oc-provider" [(ngModel)]="providerChoice" name="provider" [disabled]="providerSaving">
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
              <div class="oc-field">
                <label for="oc-apikey">API key</label>
                <input id="oc-apikey" type="password" [(ngModel)]="providerApiKey" name="apiKey"
                       placeholder="sk-..." [disabled]="providerSaving" required />
              </div>
              <div class="oc-auth-error" *ngIf="providerError">{{ providerError }}</div>
              <details class="oc-tech-details" *ngIf="providerTechnical && providerError">
                <summary>{{ setupCopy.technicalDetailsLabel }}</summary>
                <pre class="oc-tech-pre">{{ providerTechnical }}</pre>
              </details>
              <div class="oc-auth-success" *ngIf="providerSaved && !providerError">
                {{ setupCopy.providerSaveSuccess }}
              </div>
              <button type="submit" class="btn-primary"
                      [disabled]="providerSaving || !providerApiKey">
                {{ providerSaving ? 'Saving…' : 'Save key' }}
              </button>
            </form>
          </div>

          <!-- OpenClaw not detected / not connected hints -->
          <div class="oc-hint-card" *ngIf="onboarding.status().state === 'openclaw_not_detected'">
            <h3 class="oc-hint-title">Set up OpenClaw</h3>
            <p class="oc-hint-desc">
              OpenClaw is not detected yet. Copy the config below and paste it into your OpenClaw configuration file.
            </p>
            <button class="btn-primary" (click)="copyOpenClawConfig()">Copy OpenClaw config</button>
          </div>

          <div class="oc-hint-card" *ngIf="onboarding.status().state === 'openclaw_not_connected'">
            <h3 class="oc-hint-title">Connect OpenClaw</h3>
            <p class="oc-hint-desc">
              OpenClaw is installed but not yet routing through Spectyra. Make sure the config points to the Local Companion, then run a test.
            </p>
            <button class="btn-primary" (click)="copyOpenClawConfig()">Copy OpenClaw config</button>
          </div>

          <!-- Companion not running -->
          <div class="oc-hint-card" *ngIf="onboarding.status().state === 'desktop_installed_companion_not_running'">
            <h3 class="oc-hint-title">Local Companion is not running</h3>
            <p class="oc-hint-desc">
              The Local Companion needs to be running for OpenClaw to connect. Tap below to start it, or quit and reopen Spectyra.
            </p>
            <button class="btn-primary" [disabled]="onboarding.companionStartBusy()"
                    (click)="onboarding.openDesktopApp()">
              {{ onboarding.companionStartBusy() ? 'Starting…' : 'Start Local Companion' }}
            </button>
          </div>

          <div class="oc-setup-actions">
            <button class="btn-secondary" (click)="onboarding.refreshOpenClawStatus()"
                    [disabled]="onboarding.status().state === 'checking'">
              Refresh status
            </button>
            <button class="btn-primary" *ngIf="onboarding.status().state === 'ready'"
                    (click)="svc.goToStep('validate'); svc.runValidation()">
              Continue →
            </button>
          </div>
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

      /* ── First-run welcome ── */
      .ac-welcome {
        background: linear-gradient(135deg, rgba(55, 138, 221, 0.12) 0%, rgba(55, 138, 221, 0.04) 100%);
        border: 1px solid var(--spectyra-blue-border, rgba(55, 138, 221, 0.35));
        border-radius: var(--radius-card);
        padding: 18px 20px;
        margin-bottom: 28px;
      }

      .ac-welcome-inner {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        justify-content: space-between;
        gap: 16px;
      }

      .ac-welcome-copy {
        flex: 1;
        min-width: 220px;
      }

      .ac-welcome-title {
        margin: 0 0 8px;
        font-family: var(--font-display);
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .ac-welcome-text {
        margin: 0;
        font-size: 13px;
        line-height: 1.55;
        color: var(--text-secondary);
      }

      .ac-welcome-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex-shrink: 0;
      }

      .ac-welcome-hint {
        font-size: 11px;
        color: var(--text-muted);
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

      .config-section .step-sub a {
        color: var(--spectyra-blue);
      }

      /* ── OpenClaw inline readiness ── */
      .oc-checklist {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 20px;
      }

      .oc-check-row {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: var(--text-primary);
      }

      .oc-check-icon {
        font-size: 14px;
        min-width: 18px;
        text-align: center;
      }
      .oc-success { color: var(--spectyra-teal, #2dd4bf); }
      .oc-failure { color: var(--color-danger, #ef4444); }
      .oc-pending { color: var(--text-muted); }

      .oc-auth-card, .oc-hint-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        padding: 20px;
        margin-bottom: 16px;
      }

      .oc-auth-title, .oc-hint-title {
        margin: 0 0 6px;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .oc-auth-desc, .oc-hint-desc {
        margin: 0 0 14px;
        font-size: 12px;
        line-height: 1.55;
        color: var(--text-secondary);
      }

      .oc-hint-desc a { color: var(--spectyra-blue); }

      .oc-auth-form {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 360px;
      }

      .oc-field {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }

      .oc-field label {
        font-size: 11px;
        font-weight: 500;
        color: var(--text-secondary);
      }

      .oc-field input {
        padding: 7px 10px;
        border: 1px solid var(--border-bright, rgba(255,255,255,0.15));
        border-radius: 6px;
        background: var(--bg-input, rgba(0,0,0,0.25));
        color: var(--text-primary);
        font-size: 13px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s;
      }

      .oc-field input::placeholder { color: var(--text-muted, rgba(255,255,255,0.3)); }
      .oc-field input:focus, .oc-field select:focus { border-color: var(--spectyra-blue); }
      .oc-field input:disabled, .oc-field select:disabled { opacity: 0.5; }

      .oc-field select {
        padding: 7px 10px;
        border: 1px solid var(--border-bright, rgba(255,255,255,0.15));
        border-radius: 6px;
        background: var(--bg-input, rgba(0,0,0,0.25));
        color: var(--text-primary);
        font-size: 13px;
        font-family: inherit;
        outline: none;
        transition: border-color 0.15s;
        appearance: auto;
      }

      .oc-auth-error {
        font-size: 12px;
        color: var(--spectyra-red, #ef4444);
      }

      .oc-auth-success {
        font-size: 12px;
        color: var(--spectyra-green, #22c55e);
        font-weight: 500;
      }

      .oc-tech-details {
        margin: 10px 0;
        font-size: 11px;
        color: var(--text-muted);
      }
      .oc-tech-details summary { cursor: pointer; margin-bottom: 6px; }
      .oc-tech-pre {
        font-size: 10px;
        white-space: pre-wrap;
        word-break: break-word;
        background: rgba(0,0,0,0.2);
        padding: 8px;
        border-radius: 6px;
        margin: 0;
      }

      .oc-auth-toggle {
        margin: 12px 0 0;
        font-size: 12px;
        color: var(--text-muted);
      }

      .oc-link-btn {
        background: none;
        border: none;
        color: var(--spectyra-blue);
        font-size: 12px;
        cursor: pointer;
        text-decoration: underline;
        padding: 0;
      }
      .oc-link-btn:hover { color: var(--spectyra-blue-pale, #e8f4ff); }

      .oc-setup-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
        margin-top: 16px;
      }

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
  private readonly stepsDefault = ['Runtime', 'Path', 'Connection', 'Configure', 'Validate', 'Go live'];
  private readonly stepsOpenClaw = ['Runtime', 'Path', 'Setup', 'Validate', 'Go live'];
  readonly runtimeOptions = RUNTIME_OPTIONS;

  private readonly supabase = inject(SupabaseService);
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly meService = inject(MeService);
  private readonly desktop = inject(DesktopBridgeService);
  readonly onboarding = inject(IntegrationOnboardingService);

  readonly openclawChecklist = computed(() =>
    buildChecklistItems(this.onboarding.status(), { isDesktop: environment.isDesktop }),
  );
  readonly setupCopy = DESKTOP_SETUP;

  /** Shown until the user acknowledges the guided path (localStorage). */
  showFirstRunWelcome = false;

  /* ── Inline auth state ── */
  ocAuthMode: 'login' | 'register' = 'login';
  ocAuthEmail = '';
  ocAuthPassword = '';
  ocAuthOrgName = '';
  ocAuthLoading = false;
  ocAuthError: string | null = null;

  /* ── Inline provider key state ── */
  providerChoice = 'openai';
  providerApiKey = '';
  providerSaving = false;
  providerError: string | null = null;
  /** Raw hint from main process — optional disclosure only. */
  providerTechnical: string | null = null;
  providerSaved = false;

  constructor(
    public svc: AgentCompanionService,
    private router: Router,
    private firstRun: DesktopFirstRunService,
  ) {}

  ngOnInit() {
    this.showFirstRunWelcome = !this.firstRun.hasAcknowledgedAgentCompanionGuide();
    if (this.svc.state.runtime === 'openclaw' && this.svc.state.step === 'configure') {
      void this.onboarding.refreshOpenClawStatus();
    }
  }

  get selectedRuntime(): RuntimeOption | null {
    return this.svc.selectedRuntime();
  }

  get wizardStepLabels(): string[] {
    return this.svc.state.runtime === 'openclaw' ? this.stepsOpenClaw : this.stepsDefault;
  }

  get currentStepIndex(): number {
    if (this.svc.state.runtime === 'openclaw') {
      const map: Record<WizardStep, number> = {
        'select-runtime': 0,
        'select-path': 1,
        'select-connection': 1,
        'configure': 2,
        'validate': 3,
        'go-live': 4,
      };
      return map[this.svc.state.step] ?? 0;
    }
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
    return ((this.currentStepIndex + 1) / this.wizardStepLabels.length) * 100;
  }

  get availableConnections(): ConnectionStyle[] {
    return this.selectedRuntime?.connectionStyles ?? [];
  }

  selectRuntime(type: RuntimeType) {
    this.svc.selectRuntime(type);
  }

  selectPath(path: 'new' | 'existing') {
    this.svc.selectPath(path);
    if (this.svc.state.runtime === 'openclaw') {
      void this.onboarding.refreshOpenClawStatus();
    }
  }

  selectConnection(style: ConnectionStyle) {
    this.svc.selectConnection(style);
  }

  connectionLabel(style: ConnectionStyle) {
    return this.svc.connectionLabel(style);
  }

  configureBack() {
    if (this.svc.state.runtime === 'openclaw') {
      this.svc.goToStep('select-path');
      return;
    }
    this.svc.goToStep('select-connection');
  }

  goBack(step: WizardStep) {
    this.svc.goToStep(step);
  }

  goLive() {
    this.svc.goToStep('go-live');
  }

  navigateToLive() {
    this.firstRun.acknowledgeAgentCompanionGuide();
    void this.router.navigateByUrl('/desktop/live');
  }

  /** Skip the wizard for now; still mark onboarding so startup defaults to Live. */
  continueToLiveDashboard() {
    this.firstRun.acknowledgeAgentCompanionGuide();
    this.showFirstRunWelcome = false;
    void this.router.navigateByUrl('/desktop/live');
  }

  async copyText(text: string) {
    await navigator.clipboard.writeText(text);
  }

  async copyOpenClawConfig() {
    await this.onboarding.copyOpenClawConfig();
  }

  async saveProviderKey(): Promise<void> {
    if (!this.providerApiKey.trim()) return;
    this.providerSaving = true;
    this.providerError = null;
    this.providerTechnical = null;
    this.providerSaved = false;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
        const result = await this.desktop.setProviderKey(this.providerChoice, this.providerApiKey.trim());
        const friendly = friendlyProviderKeyUserMessage(result);
        if (friendly.success) {
          this.providerApiKey = '';
          this.providerSaved = true;
          for (let i = 0; i < 10; i++) {
            await this.onboarding.refreshOpenClawStatus();
            if (this.onboarding.status().providerConfigured) break;
            await new Promise((r) => setTimeout(r, 400));
          }
          return;
        }
        if (attempt === 2) {
          this.providerError = friendly.message;
          this.providerTechnical = friendly.technical ?? null;
          await this.onboarding.refreshOpenClawStatus();
        }
      }
    } catch (e: unknown) {
      this.providerError = DESKTOP_SETUP.providerSaveFailed;
      this.providerTechnical = e instanceof Error ? e.message : String(e);
    } finally {
      this.providerSaving = false;
    }
  }

  async ocDoSignIn(): Promise<void> {
    if (!this.ocAuthEmail || !this.ocAuthPassword) return;
    this.ocAuthLoading = true;
    this.ocAuthError = null;
    try {
      const { error } = await this.supabase.signIn(this.ocAuthEmail, this.ocAuthPassword);
      if (error) {
        this.ocAuthError = error.message || 'Sign-in failed';
        this.ocAuthLoading = false;
        return;
      }
      this.meService.clearCache();
      await this.onboarding.refreshOpenClawStatus();
    } catch (e: any) {
      this.ocAuthError = e.message || 'Sign-in failed';
    } finally {
      this.ocAuthLoading = false;
    }
  }

  async ocDoSignUp(): Promise<void> {
    if (!this.ocAuthEmail || !this.ocAuthPassword || !this.ocAuthOrgName) return;
    if (this.ocAuthPassword.length < 8) {
      this.ocAuthError = 'Password must be at least 8 characters';
      return;
    }
    this.ocAuthLoading = true;
    this.ocAuthError = null;
    try {
      const { error: signUpError, session, user } = await this.supabase.signUp(this.ocAuthEmail, this.ocAuthPassword);
      if (signUpError) {
        this.ocAuthError = signUpError.message || 'Failed to create account';
        this.ocAuthLoading = false;
        return;
      }

      let token: string | null = session?.access_token ?? null;
      if (user && !token) {
        try {
          const confirmRes = await fetch(`${environment.apiUrl}/auth/auto-confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this.ocAuthEmail }),
          });
          if (!confirmRes.ok) console.warn('[agent-companion] auto-confirm failed', confirmRes.status);
        } catch (e) {
          console.warn('[agent-companion] auto-confirm error', e);
        }
        const { error: signInError } = await this.supabase.signIn(this.ocAuthEmail, this.ocAuthPassword);
        if (signInError) console.warn('[agent-companion] post-confirm sign-in failed', signInError);
        await new Promise(r => setTimeout(r, 500));
        token = await this.supabase.getAccessToken();
      }
      if (!token) {
        await new Promise(r => setTimeout(r, 1000));
        token = await this.supabase.getAccessToken();
      }
      if (!token) {
        this.ocAuthError = 'Account created but session could not be established. Try signing in.';
        this.ocAuthMode = 'login';
        this.ocAuthLoading = false;
        return;
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      });
      try {
        const response = await firstValueFrom(this.http.post<any>(
          `${environment.apiUrl}/auth/bootstrap`,
          { org_name: this.ocAuthOrgName.trim() },
          { headers },
        ));
        if (response?.api_key) this.authService.setApiKey(response.api_key);
      } catch (bootstrapErr: any) {
        if (bootstrapErr.status !== 400 || !bootstrapErr.error?.error?.includes('already exists')) {
          console.warn('[agent-companion] bootstrap error', bootstrapErr);
        }
      }
      this.meService.clearCache();
      await this.onboarding.refreshOpenClawStatus();
    } catch (e: any) {
      this.ocAuthError = e.message || 'Failed to create account';
    } finally {
      this.ocAuthLoading = false;
    }
  }
}
