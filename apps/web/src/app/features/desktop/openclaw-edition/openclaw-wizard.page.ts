import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SpectyraMarkIconComponent } from '../../../components/spectyra-mark-icon.component';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DesktopBridgeService } from '../../../core/desktop/desktop-bridge.service';
import { OpenClawDesktopService } from '../../../core/desktop/openclaw-desktop.service';
import { LocalCompanionDiagnosticsService } from '../../../core/desktop/local-companion-diagnostics.service';
import { CompanionAnalyticsService } from '../../../core/analytics/companion-analytics.service';
import { DESKTOP_SETUP, friendlyProviderKeyUserMessage } from '../../../core/desktop/desktop-setup-messages';
import { OPENCLAW_INSTALL_BASH, OPENCLAW_NODE_VERSION_MIN } from '@spectyra/shared';
import { supabase } from '../../../core/supabase/supabase.client';
import { SupabaseService } from '../../../services/supabase.service';
import { AuthService } from '../../../core/auth/auth.service';
import { MeService } from '../../../core/services/me.service';

type WizardStep = 'welcome' | 'account' | 'install' | 'provider' | 'connect' | 'verify' | 'done';

const STEP_ORDER: WizardStep[] = ['welcome', 'account', 'install', 'provider', 'connect', 'verify', 'done'];

@Component({
  selector: 'app-openclaw-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule, SpectyraMarkIconComponent],
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

      <!-- WELCOME (hidden until status loads — avoids flashing install copy before we can jump to Account) -->
      <section class="wiz-panel" *ngIf="wizardReady && step === 'welcome'">
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

      <!-- ACCOUNT -->
      <section class="wiz-panel" *ngIf="step === 'account'">
        <ng-container *ngIf="signedIn">
          <div class="install-success">
            <span class="install-success-icon">&#10003;</span>
            <h1 class="wiz-title">You're signed in to Spectyra</h1>
            <p class="wiz-lead" *ngIf="authEmail">
              Signed in as <strong>{{ authEmail }}</strong>.
              <ng-container *ngIf="cliDetected">OpenClaw is already on this Mac — continue to connect your AI provider and Spectyra.</ng-container>
              <ng-container *ngIf="!cliDetected">Next we will install OpenClaw, then your provider key.</ng-container>
            </p>
            <p class="wiz-lead" *ngIf="!authEmail">
              Your Spectyra session is active.
              <ng-container *ngIf="cliDetected">OpenClaw is already installed — continue to finish setup.</ng-container>
              <ng-container *ngIf="!cliDetected">Next we will install OpenClaw, then your provider key.</ng-container>
            </p>
          </div>
          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
            <button class="wiz-btn primary" (click)="next()">Continue</button>
          </div>
        </ng-container>

        <ng-container *ngIf="!signedIn">
          <h1 class="wiz-title">{{ authMode === 'login' ? 'Sign in to Spectyra' : 'Create your Spectyra account' }}</h1>
          <p class="wiz-lead">
            {{ authMode === 'login'
              ? 'Sign in to connect OpenClaw with your Spectyra dashboard, analytics, and optimization.'
              : 'A free account connects OpenClaw with Spectyra optimization, analytics, and your cloud dashboard.' }}
          </p>

          <form class="wiz-auth-form" (ngSubmit)="authMode === 'login' ? doSignIn() : doSignUp()">
            <div class="wiz-field">
              <label for="wiz-email">Email</label>
              <input id="wiz-email" type="email" [(ngModel)]="authEmail" name="email"
                     placeholder="you@example.com" [disabled]="authLoading" required autocomplete="email" />
            </div>
            <div class="wiz-field">
              <label for="wiz-pass">Password</label>
              <input id="wiz-pass" type="password" [(ngModel)]="authPassword" name="password"
                     placeholder="••••••••" [disabled]="authLoading" required minlength="8" autocomplete="current-password" />
            </div>
            <div class="wiz-field" *ngIf="authMode === 'register'">
              <label for="wiz-org">Organization name</label>
              <input id="wiz-org" type="text" [(ngModel)]="authOrgName" name="orgName"
                     placeholder="My Company" [disabled]="authLoading" required />
            </div>
            <p class="wiz-err" *ngIf="authError">{{ authError }}</p>
            <button type="submit" class="wiz-btn primary wiz-auth-submit"
                    [disabled]="authLoading || !authEmail || !authPassword || (authMode === 'register' && !authOrgName)">
              {{ authLoading
                ? (authMode === 'login' ? 'Signing in…' : 'Creating account…')
                : (authMode === 'login' ? 'Sign in' : 'Create free account') }}
            </button>
          </form>

          <p class="wiz-auth-toggle">
            <ng-container *ngIf="authMode === 'login'">
              No account? <button type="button" class="wiz-link-btn" (click)="authMode = 'register'; authError = null">Sign up free</button>
            </ng-container>
            <ng-container *ngIf="authMode === 'register'">
              Already have an account? <button type="button" class="wiz-link-btn" (click)="authMode = 'login'; authError = null">Sign in</button>
            </ng-container>
          </p>

          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
          </div>
        </ng-container>
      </section>

      <!-- INSTALL -->
      <section class="wiz-panel" *ngIf="step === 'install'">

        <!-- ✅ SUCCESS: OpenClaw found -->
        <ng-container *ngIf="cliDetected">
          <div class="install-success">
            <span class="install-success-icon">&#10003;</span>
            <h1 class="wiz-title">OpenClaw is installed</h1>
            <p class="wiz-lead">
              We detected <code>openclaw</code> on this computer. You're ready to connect your AI provider.
            </p>
          </div>
          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
            <button class="wiz-btn primary" (click)="next()">Continue to provider setup</button>
          </div>
        </ng-container>

        <!-- ⏳ INSTALLING: inline install running -->
        <ng-container *ngIf="!cliDetected && installing">
          <h1 class="wiz-title">Installing OpenClaw…</h1>
          <p class="wiz-lead">
            This usually takes under a minute. You can watch the progress below.
          </p>

          <div class="install-terminal">
            <pre class="install-terminal-output" #installOutput>{{ installLog }}</pre>
          </div>

          <div class="install-waiting">
            <div class="install-waiting-spinner"></div>
            <p class="install-waiting-sub">Installing…</p>
          </div>

          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
          </div>
        </ng-container>

        <!-- ⏳ WAITING: terminal was opened externally -->
        <ng-container *ngIf="!cliDetected && !installing && terminalOpened">
          <h1 class="wiz-title">Waiting for install…</h1>
          <p class="wiz-lead">
            The installer is running in your terminal. When it finishes, we'll detect it automatically.
          </p>

          <div class="install-waiting">
            <div class="install-waiting-spinner"></div>
            <p class="install-waiting-text">Waiting for install to complete…</p>
            <p class="install-waiting-sub">Checking every few seconds</p>
          </div>

          <p class="wiz-hint install-hint" *ngIf="pollCount > 10">
            Still waiting? Try closing and reopening Spectyra, or tap <strong>Re-check</strong> below.
          </p>

          <div class="wiz-check-row checking">
            <span class="wiz-check-dot spin"></span>
            <span class="wiz-check-text">
              {{ checkingCli ? 'Checking…' : 'OpenClaw not found yet' }}
            </span>
            <button class="wiz-btn tiny" (click)="detectCli()" [disabled]="checkingCli">Re-check</button>
          </div>

          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
          </div>
        </ng-container>

        <!-- 🟡 INITIAL: ready to install -->
        <ng-container *ngIf="!cliDetected && !installing && !terminalOpened">
          <h1 class="wiz-title">Install OpenClaw</h1>
          <p class="wiz-lead">
            One click to install the OpenClaw AI agent on your machine. Takes about 30 seconds.
          </p>

          <button class="wiz-btn primary install-main-btn" (click)="runInstall()">
            Install OpenClaw
          </button>
          <p class="wiz-err" *ngIf="terminalErr">{{ terminalErr }}</p>

          <details class="install-manual">
            <summary class="install-manual-toggle">Or install manually</summary>
            <div class="wiz-code-block">
              <pre class="wiz-pre">{{ installCmd }}</pre>
              <button class="wiz-btn small" (click)="copyInstall()">
                {{ installCopied ? 'Copied' : 'Copy' }}
              </button>
            </div>
            <p class="wiz-hint">
              Paste this into any terminal and press Enter. Then tap
              <button type="button" class="wiz-link-btn" (click)="markTerminalOpened()">I've finished installing</button>.
            </p>
          </details>

          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
          </div>
        </ng-container>

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

        <!-- ✅ Skill installed -->
        <ng-container *ngIf="skillInstalled">
          <div class="install-success">
            <span class="install-success-icon">&#10003;</span>
            <h1 class="wiz-title">Connected</h1>
            <p class="wiz-lead">
              The Spectyra skill is installed. OpenClaw will now route through Spectyra's
              Local Companion for automatic optimization.
            </p>
          </div>
          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
            <button class="wiz-btn primary" (click)="next()">Continue to verify</button>
          </div>
        </ng-container>

        <!-- ⏳ Installing skill -->
        <ng-container *ngIf="!skillInstalled && skillInstalling">
          <h1 class="wiz-title">Connecting OpenClaw to Spectyra…</h1>
          <p class="wiz-lead">
            Installing the Spectyra skill into OpenClaw. This configures routing through
            the Local Companion automatically.
          </p>
          <div class="install-waiting">
            <div class="install-waiting-spinner"></div>
            <p class="install-waiting-text">Installing Spectyra skill…</p>
          </div>
          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
          </div>
        </ng-container>

        <!-- 🟡 Ready to connect -->
        <ng-container *ngIf="!skillInstalled && !skillInstalling">
          <h1 class="wiz-title">Connect OpenClaw to Spectyra</h1>
          <p class="wiz-lead">
            This installs the Spectyra skill into OpenClaw, which configures it to route
            all AI requests through Spectyra's Local Companion for automatic optimization.
          </p>

          <div class="connect-what">
            <h4 class="connect-what-title">What happens:</h4>
            <ul class="connect-what-list">
              <li>Runs <code>openclaw skills install spectyra</code></li>
              <li>Adds Spectyra as a model provider in OpenClaw's config</li>
              <li>Sets <code>spectyra/smart</code> as the default model</li>
              <li>All traffic stays local — nothing leaves your machine</li>
            </ul>
          </div>

          <button class="wiz-btn primary install-main-btn" (click)="installSkill()">
            Install Spectyra skill
          </button>
          <p class="wiz-err" *ngIf="skillError">{{ skillError }}</p>

          <details class="install-manual">
            <summary class="install-manual-toggle">Or configure manually</summary>
            <div class="wiz-code-block">
              <pre class="wiz-pre">{{ configJson || 'Loading…' }}</pre>
              <button class="wiz-btn small" (click)="copyConfig()">
                {{ configCopied ? 'Copied' : 'Copy settings' }}
              </button>
            </div>
            <p class="wiz-hint">
              Paste into your OpenClaw config file.
              Run <code>openclaw config path</code> to find it, or:
            </p>
            <div class="wiz-row">
              <button class="wiz-btn secondary" (click)="openConfig()">Open config file</button>
            </div>
          </details>

          <div class="wiz-actions">
            <button class="wiz-btn secondary" (click)="prev()">Back</button>
            <button class="wiz-btn secondary" (click)="next()">Skip — I'll configure later</button>
          </div>
        </ng-container>

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
          <mat-icon class="wiz-done-check" aria-hidden="true">check_circle</mat-icon>
          <h1 class="wiz-title">You're all set</h1>
          <p class="wiz-lead">
            OpenClaw is connected to Spectyra. Explore skills, set up assistant profiles, or
            go straight to the live dashboard.
          </p>
          <p class="wiz-done-hint" *ngIf="companionDashboardUrl">
            <strong>Local savings in any browser:</strong>
            <a class="wiz-done-link" [href]="companionDashboardUrl" target="_blank" rel="noopener noreferrer">{{ companionDashboardUrl }}</a>
            — same companion metrics as from the terminal. You can also run
            <code class="wiz-code-inline">spectyra-companion dashboard</code> from npm.
          </p>
        </div>

        <div class="wiz-done-grid">
          <a class="wiz-done-card" routerLink="/desktop/home">
            <mat-icon class="wiz-done-icon">space_dashboard</mat-icon>
            <span class="wiz-done-label">Dashboard</span>
            <span class="wiz-done-desc">See status and activity at a glance</span>
          </a>
          <a class="wiz-done-card" routerLink="/desktop/skills">
            <mat-icon class="wiz-done-icon">extension</mat-icon>
            <span class="wiz-done-label">Install Skills</span>
            <span class="wiz-done-desc">Browse ClawHub and add capabilities</span>
          </a>
          <a class="wiz-done-card" routerLink="/desktop/assistants">
            <mat-icon class="wiz-done-icon">manage_accounts</mat-icon>
            <span class="wiz-done-label">Assistants</span>
            <span class="wiz-done-desc">Configure assistant profiles</span>
          </a>
          <a class="wiz-done-card" routerLink="/desktop/live">
            <span class="wiz-done-mark" aria-hidden="true"><app-spectyra-mark></app-spectyra-mark></span>
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
    .wiz-hint.install-hint { margin-top: 14px; line-height: 1.45; }

    /* ── Install step states ── */
    .install-main-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      padding: 14px 28px;
      margin-bottom: 16px;
    }

    .install-manual {
      margin: 8px 0 20px;
    }
    .install-manual-toggle {
      cursor: pointer;
      font-size: 13px;
      color: var(--spectyra-blue, #378ADD);
      margin-bottom: 10px;
    }
    .install-manual-toggle:hover { text-decoration: underline; }

    .install-terminal {
      margin-bottom: 16px;
    }
    .install-terminal-output {
      background: #0a0e17;
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 8px;
      padding: 14px 16px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 12px;
      line-height: 1.5;
      color: #8ec8a0;
      max-height: 200px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-all;
      margin: 0;
    }

    .install-waiting {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 36px 0 28px;
    }
    .install-waiting-spinner {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      border: 3px solid var(--border-bright, rgba(55,138,221,0.25));
      border-top-color: var(--spectyra-blue, #378ADD);
      animation: spinnerRotate 0.9s linear infinite;
    }
    @keyframes spinnerRotate { to { transform: rotate(360deg); } }
    .install-waiting-text {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary, #e8f1fb);
      margin: 0;
    }
    .install-waiting-sub {
      font-size: 12px;
      color: var(--text-muted, #3d5a78);
      margin: 0;
    }

    .install-success {
      text-align: center;
      padding: 24px 0 8px;
    }
    .install-success-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--spectyra-teal, #1D9E75);
      color: #fff;
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 16px;
      animation: scaleIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

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
      width: 56px !important;
      height: 56px !important;
      border-radius: 50%;
      background: var(--spectyra-teal, #1D9E75);
      color: #fff !important;
      font-size: 36px !important;
      margin-bottom: 16px;
    }
    .wiz-done-hero .wiz-title { margin-bottom: 12px; }
    .wiz-done-hero .wiz-lead { max-width: 400px; margin: 0 auto; }
    .wiz-done-hint {
      max-width: 440px;
      margin: 16px auto 0;
      font-size: 13px;
      line-height: 1.55;
      color: var(--text-secondary, #7a9fc0);
      text-align: left;
    }
    .wiz-done-link {
      color: var(--spectyra-teal-light, #5dcaa5);
      word-break: break-all;
    }
    .wiz-code-inline {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 11px;
      padding: 1px 5px;
      border-radius: 4px;
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
    }

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
      font-size: 26px;
      width: 26px;
      height: 26px;
      margin-bottom: 4px;
      color: var(--spectyra-blue, #378add);
    }
    .wiz-done-mark {
      display: flex;
      margin-bottom: 4px;
      --spectyra-mark-size: 28px;
      --spectyra-mark-color: var(--spectyra-blue, #378add);
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

    /* ── Connect step ── */
    .connect-what {
      background: var(--bg-card, #121c2e);
      border: 1px solid var(--border, rgba(55,138,221,0.12));
      border-radius: 10px;
      padding: 16px 20px;
      margin-bottom: 24px;
    }
    .connect-what-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary, #e8f1fb);
      margin: 0 0 10px;
    }
    .connect-what-list {
      margin: 0;
      padding-left: 18px;
      font-size: 13px;
      color: var(--text-secondary, #7a9fc0);
      line-height: 1.6;
    }
    .connect-what-list code {
      font-size: 12px;
      background: rgba(55,138,221,0.08);
      padding: 1px 5px;
      border-radius: 3px;
    }

    /* ── Auth form ── */
    .wiz-auth-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .wiz-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .wiz-field label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary, #7a9fc0);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .wiz-field input {
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid var(--border-bright, rgba(55,138,221,0.25));
      background: var(--bg-card, #121c2e);
      color: var(--text-primary, #e8f1fb);
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.15s;
    }
    .wiz-field input:focus {
      outline: none;
      border-color: var(--spectyra-blue, #378ADD);
    }
    .wiz-field input:disabled {
      opacity: 0.5;
    }
    .wiz-auth-submit { margin-top: 4px; }
    .wiz-auth-toggle {
      font-size: 13px;
      color: var(--text-muted, #3d5a78);
      margin-top: 16px;
    }
    .wiz-link-btn {
      background: none;
      border: none;
      color: var(--spectyra-blue, #378ADD);
      cursor: pointer;
      font-size: 13px;
      padding: 0;
      text-decoration: underline;
    }
    .wiz-link-btn:hover { color: var(--spectyra-blue-light, #6ab4f5); }
  `],
})
export class OpenClawWizardPage implements OnInit, OnDestroy {
  private readonly desktop = inject(DesktopBridgeService);
  private readonly oc = inject(OpenClawDesktopService);
  private readonly diagnostics = inject(LocalCompanionDiagnosticsService);
  private readonly companionAnalytics = inject(CompanionAnalyticsService);
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly meService = inject(MeService);
  private readonly http = inject(HttpClient);
  private installPoll: ReturnType<typeof setInterval> | null = null;

  readonly steps = STEP_ORDER;
  readonly stepLabels: Record<WizardStep, string> = {
    welcome: 'Welcome',
    account: 'Account',
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

  signedIn = false;
  authMode: 'login' | 'register' = 'register';
  authEmail = '';
  authPassword = '';
  authOrgName = '';
  authLoading = false;
  authError: string | null = null;

  cliDetected = false;
  checkingCli = false;
  installing = false;
  installLog = '';
  installCopied = false;
  terminalOpened = false;
  pollCount = 0;
  terminalErr: string | null = null;

  provider = 'openai';
  apiKey = '';
  keySaving = false;
  keyError: string | null = null;
  keyOk = false;

  configJson = '';
  configCopied = false;

  skillInstalled = false;
  skillInstalling = false;
  skillError: string | null = null;

  verifyChecks: Array<{ label: string; ok: boolean | null; detail?: string }> = [];
  verifying = false;
  doctorBusy = false;
  doctorOutput: string | null = null;

  /** Local companion `/dashboard` for browser savings (npm + Desktop users). */
  companionDashboardUrl: string | null = null;

  /** False until `refreshStatus` finishes — keeps welcome copy from flashing before we may switch steps. */
  wizardReady = false;

  get allPassing(): boolean {
    return this.verifyChecks.length > 0 && this.verifyChecks.every((c) => c.ok === true);
  }

  async ngOnInit(): Promise<void> {
    this.canTerminal = this.desktop.isElectronRenderer;

    const [cfg, status, token] = await Promise.all([
      this.desktop.getConfig(),
      this.oc.refreshStatus(),
      this.supabase.getAccessToken().catch(() => null),
    ]);

    this.signedIn = !!token;
    /**
     * Desktop build skips AuthSessionService user stream; `authEmail` must come from Supabase session
     * or the Account step shows "Signed in as ." with an empty name.
     */
    try {
      const { data: sessionRes } = await supabase.auth.getSession();
      let email = sessionRes.session?.user?.email?.trim();
      if (!email) {
        const { data: userRes } = await supabase.auth.getUser();
        email = userRes.user?.email?.trim();
      }
      if (email) this.authEmail = email;
    } catch {
      /* ignore */
    }

    if (cfg && typeof cfg['provider'] === 'string') this.provider = cfg['provider'] as string;
    this.cliDetected = status.cliDetected || status.openclawDetected || status.gatewayReachable;
    this.canSkip = status.companionHealthy && status.providerConfigured;

    const hasOpenClaw = status.openclawDetected || status.cliDetected || status.gatewayReachable;
    if (hasOpenClaw && this.step === 'welcome') {
      this.step = 'account';
    }

    try {
      this.configJson = await this.diagnostics.buildOpenClawConfigJson();
    } catch {
      this.configJson = (await this.desktop.openClawExample()) || '';
    }

    if (this.cliDetected) {
      try {
        const installed = await this.oc.loadInstalledSkills();
        this.skillInstalled = installed.some(s => s.name.toLowerCase().includes('spectyra'));
      } catch { /* ignore */ }
    }

    try {
      const origin = await this.companionAnalytics.resolveCompanionOrigin();
      this.companionDashboardUrl = `${origin.replace(/\/$/, "")}/dashboard`;
    } catch {
      this.companionDashboardUrl = `${environment.companionBaseUrl.replace(/\/$/, "")}/dashboard`;
    }

    this.wizardReady = true;
  }

  ngOnDestroy(): void {
    this.stopInstallPoll();
    this.desktop.removeInstallOutputListeners();
  }

  private syncInstallPoll(): void {
    if (this.step === 'install') {
      void this.detectCli();
      this.startInstallPoll();
    } else {
      this.stopInstallPoll();
    }
  }

  private startInstallPoll(): void {
    this.stopInstallPoll();
    this.pollCount = 0;
    this.installPoll = setInterval(() => {
      if (this.step !== 'install') {
        this.stopInstallPoll();
        return;
      }
      if (this.cliDetected) {
        this.stopInstallPoll();
        return;
      }
      this.pollCount++;
      void this.detectCli();
    }, 4000);
  }

  private stopInstallPoll(): void {
    if (this.installPoll != null) {
      clearInterval(this.installPoll);
      this.installPoll = null;
    }
  }

  goTo(s: WizardStep): void {
    this.step = s;
    this.syncInstallPoll();
    if (s === 'verify') void this.runVerify();
    if (s === 'connect') void this.autoConnectIfReady();
  }

  next(): void {
    const i = this.stepIdx;
    if (this.step === 'account' && !this.signedIn) return;
    if (this.step === 'provider' && !this.keyOk) {
      void this.saveKey();
      return;
    }
    if (i < STEP_ORDER.length - 1) {
      this.step = STEP_ORDER[i + 1];
      this.syncInstallPoll();
      if (this.step === 'verify') void this.runVerify();
      if (this.step === 'connect') void this.autoConnectIfReady();
    }
  }

  private async autoConnectIfReady(): Promise<void> {
    if (this.skillInstalled || this.skillInstalling) return;
    void this.installSkill();
  }

  prev(): void {
    const i = this.stepIdx;
    if (i > 0) {
      this.step = STEP_ORDER[i - 1];
      this.syncInstallPoll();
    }
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
    if (!r.ok) {
      this.terminalErr = r.error || 'Could not open terminal.';
      return;
    }
    this.terminalOpened = true;
    this.pollCount = 0;
    if (this.step === 'install') this.syncInstallPoll();
  }

  @ViewChild('installOutput') installOutputEl?: ElementRef<HTMLPreElement>;

  markTerminalOpened(): void {
    this.terminalOpened = true;
    this.pollCount = 0;
    this.syncInstallPoll();
  }

  async runInstall(): Promise<void> {
    if (!this.desktop.canInstallInline) {
      void this.runTerminal();
      return;
    }
    this.installing = true;
    this.installLog = '';
    this.terminalErr = null;

    this.desktop.onInstallOutput((data: string) => {
      this.installLog += data;
      setTimeout(() => {
        const el = this.installOutputEl?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });

    const result = await this.desktop.runOpenClawInstallInline();
    this.desktop.removeInstallOutputListeners();
    this.installing = false;

    if (result.ok) {
      await this.detectCli();
      if (!this.cliDetected) {
        this.terminalOpened = true;
        this.syncInstallPoll();
      }
    } else {
      this.terminalErr = result.error || 'Installation failed. Try the manual method below.';
    }
  }

  // ── Auth ──

  async doSignIn(): Promise<void> {
    if (!this.authEmail || !this.authPassword) return;
    this.authLoading = true;
    this.authError = null;
    try {
      const { error } = await this.supabase.signIn(this.authEmail, this.authPassword);
      if (error) {
        this.authError = error.message || 'Sign-in failed';
        return;
      }
      this.signedIn = true;
      this.meService.clearCache();

      await this.provisionLicenseKeyIfNeeded();

      this.next();
    } catch (e: any) {
      this.authError = e.message || 'Sign-in failed';
    } finally {
      this.authLoading = false;
    }
  }

  /**
   * If the Desktop companion has no active license key, generate one server-side and activate it locally.
   * Called after sign-in for existing users who may not have a key yet.
   */
  private async provisionLicenseKeyIfNeeded(): Promise<void> {
    if (!this.desktop.isElectronRenderer) return;

    const cfg = await this.desktop.getConfig();
    if (cfg?.['licenseKey']) return;

    try {
      const token = await this.supabase.getAccessToken();
      if (!token) return;

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      });
      const res = await firstValueFrom(this.http.post<any>(
        `${environment.apiUrl}/license/generate`,
        { device_name: 'desktop-auto' },
        { headers },
      ));
      if (res?.license_key) {
        const lkResult = await this.desktop.activateLicense(res.license_key);
        if (!lkResult.ok) {
          console.warn('[openclaw-wizard] license activation failed on sign-in', lkResult.error);
        }
      }
    } catch (e: any) {
      console.warn('[openclaw-wizard] license provisioning on sign-in failed', e.message || e);
    }
  }

  async doSignUp(): Promise<void> {
    if (!this.authEmail || !this.authPassword || !this.authOrgName) return;
    if (this.authPassword.length < 8) {
      this.authError = 'Password must be at least 8 characters';
      return;
    }
    this.authLoading = true;
    this.authError = null;
    try {
      const { error: signUpError, session, user } = await this.supabase.signUp(this.authEmail, this.authPassword);
      if (signUpError) {
        this.authError = signUpError.message || 'Failed to create account';
        return;
      }

      let token: string | null = session?.access_token ?? null;
      if (user && !token) {
        try {
          const confirmRes = await fetch(`${environment.apiUrl}/auth/auto-confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: this.authEmail }),
          });
          if (!confirmRes.ok) console.warn('[openclaw-wizard] auto-confirm failed', confirmRes.status);
        } catch (e) {
          console.warn('[openclaw-wizard] auto-confirm error', e);
        }
        const { error: signInError } = await this.supabase.signIn(this.authEmail, this.authPassword);
        if (signInError) console.warn('[openclaw-wizard] post-confirm sign-in failed', signInError);
        await new Promise(r => setTimeout(r, 500));
        token = await this.supabase.getAccessToken();
      }
      if (!token) {
        await new Promise(r => setTimeout(r, 1000));
        token = await this.supabase.getAccessToken();
      }
      if (!token) {
        this.authError = 'Account created but session could not be established. Try signing in.';
        this.authMode = 'login';
        return;
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      });
      try {
        const response = await firstValueFrom(this.http.post<any>(
          `${environment.apiUrl}/auth/bootstrap`,
          { org_name: this.authOrgName.trim() },
          { headers },
        ));
        if (response?.api_key) this.authService.setApiKey(response.api_key);
        if (response?.license_key) {
          const lkResult = await this.desktop.activateLicense(response.license_key);
          if (!lkResult.ok) {
            console.warn('[openclaw-wizard] license activation failed', lkResult.error);
          }
        }
      } catch (bootstrapErr: any) {
        if (bootstrapErr.status !== 400 || !bootstrapErr.error?.error?.includes('already exists')) {
          console.warn('[openclaw-wizard] bootstrap error', bootstrapErr);
        }
      }

      this.signedIn = true;
      this.meService.clearCache();
      this.next();
    } catch (e: any) {
      this.authError = e.message || 'Failed to create account';
    } finally {
      this.authLoading = false;
    }
  }

  // ── Provider key ──

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

  async installSkill(): Promise<void> {
    this.skillInstalling = true;
    this.skillError = null;
    try {
      const r = await this.oc.installSkill('spectyra');
      if (r.ok) {
        this.skillInstalled = true;
      } else {
        this.skillError = r.error || 'Failed to install the Spectyra skill. Try the manual method below.';
      }
    } catch (e: any) {
      this.skillError = e.message || 'Unexpected error installing the Spectyra skill.';
    } finally {
      this.skillInstalling = false;
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
