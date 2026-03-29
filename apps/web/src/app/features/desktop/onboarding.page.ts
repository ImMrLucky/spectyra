import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { DesktopBridgeService } from '../../core/desktop/desktop-bridge.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-desktop-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
  ],
  template: `
    <div class="wrap" *ngIf="step === 1">
      <h1>How do you want to use Spectyra?</h1>
      <p class="sub">Pick a path. You can open full setup guides on the website; local keys are configured on the next step.</p>

      <div class="choice-grid">
        <mat-card class="choice" (click)="chooseUseCase('sdk')">
          <mat-card-title>With my app code (SDK)</mat-card-title>
          <mat-card-content>Best fidelity — wrap LLM calls in your codebase.</mat-card-content>
        </mat-card>
        <mat-card class="choice" (click)="chooseUseCase('openclaw')">
          <mat-card-title>OpenClaw or a local agent tool</mat-card-title>
          <mat-card-content>Point tools at Spectyra on localhost — no app code changes.</mat-card-content>
        </mat-card>
        <mat-card class="choice" (click)="chooseUseCase('server')">
          <mat-card-title>Server or VM agent</mat-card-title>
          <mat-card-content>Run Spectyra beside cloud or VM workloads.</mat-card-content>
        </mat-card>
        <mat-card class="choice" (click)="chooseUseCase('events')">
          <mat-card-title>Logs / events / traces</mat-card-title>
          <mat-card-content>Analytics-first — structured local signals (optional path).</mat-card-content>
        </mat-card>
      </div>
      <p class="hint">We’ll open the matching guide in your browser when helpful. Continue to configure your provider on this machine.</p>
      <button mat-stroked-button color="primary" type="button" (click)="skipToProviderConfig()">Skip — configure provider now</button>
    </div>

    <div class="wrap" *ngIf="step === 2">
      <button mat-button type="button" (click)="backToStep1()" class="back">← Back</button>
      <h1>Welcome to Spectyra</h1>
      <p class="sub">Configure your local provider. Keys are stored only on this computer.</p>

      <mat-card class="card">
        <mat-card-title>Upstream provider</mat-card-title>
        <mat-card-content>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Provider</mat-label>
            <mat-select [(ngModel)]="provider">
              <mat-option value="openai">OpenAI</mat-option>
              <mat-option value="anthropic">Anthropic</mat-option>
              <mat-option value="groq">Groq</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>API key</mat-label>
            <input matInput type="password" [(ngModel)]="apiKey" autocomplete="off" />
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <mat-card class="card">
        <mat-card-title>Run mode</mat-card-title>
        <mat-card-content>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Mode</mat-label>
            <mat-select [(ngModel)]="runMode">
              <mat-option value="on">On — live optimization (recommended)</mat-option>
              <mat-option value="off">Off — pass-through</mat-option>
              <mat-option value="observe">Observe — projected savings only (optional)</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Telemetry</mat-label>
            <mat-select [(ngModel)]="telemetryMode">
              <mat-option value="local">Local (default)</mat-option>
              <mat-option value="off">Off</mat-option>
              <mat-option value="cloud_redacted">Cloud — redacted only</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Prompt snapshots</mat-label>
            <mat-select [(ngModel)]="promptSnapshots">
              <mat-option value="local_only">Local only (default)</mat-option>
              <mat-option value="none">None</mat-option>
              <mat-option value="cloud_opt_in">Cloud opt-in</mat-option>
            </mat-select>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <p class="notice">
        Provider billing stays on your account. Spectyra does not route inference through Spectyra servers by default.
      </p>

      <button mat-raised-button color="primary" (click)="save()" [disabled]="saving">Save &amp; continue</button>
      <p class="err" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [
    `
      .wrap {
        max-width: 560px;
        margin: 0 auto;
        padding: 24px 20px 48px;
        font-family: var(--font-body);
      }

      h1 {
        margin: 0 0 8px;
        font-family: var(--font-display);
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .sub {
        color: var(--text-secondary);
        font-size: 13px;
        margin-bottom: 20px;
        line-height: 1.5;
      }

      .choice-grid {
        display: grid;
        gap: 10px;
        margin-bottom: 16px;
      }

      .choice {
        cursor: pointer;
        background: var(--bg-card) !important;
        border: 1px solid var(--border) !important;
        transition: border-color 0.15s ease;
      }

      .choice:hover {
        border-color: var(--border-bright) !important;
      }

      .choice mat-card-title {
        font-size: 14px;
        color: var(--text-primary);
      }

      .choice mat-card-content {
        font-size: 12px;
        color: var(--text-secondary);
      }

      .hint {
        font-size: 12px;
        color: var(--text-muted);
        margin: 12px 0 16px;
        line-height: 1.5;
      }

      .back {
        margin-bottom: 14px;
        color: var(--text-muted) !important;
      }

      .card {
        margin-bottom: 16px;
        background: var(--bg-card) !important;
        border: 1px solid var(--border) !important;
      }

      .full { width: 100%; display: block; margin-bottom: 8px; }

      .notice {
        font-size: 12px;
        color: var(--text-muted);
        margin: 16px 0;
        line-height: 1.5;
      }

      .err { color: var(--color-danger); font-size: 12px; }
    `,
  ],
})
export class DesktopOnboardingPage implements OnInit {
  step: 1 | 2 = 1;
  provider = 'openai';
  apiKey = '';
  runMode = 'on';
  telemetryMode = 'local';
  promptSnapshots = 'local_only';
  saving = false;
  error = '';

  constructor(
    private desktop: DesktopBridgeService,
    private router: Router,
  ) {}

  ngOnInit() {
    void this.load();
  }

  chooseUseCase(which: 'sdk' | 'openclaw' | 'server' | 'events'): void {
    localStorage.setItem('spectyra_desktop_use_case', which);
    const base = (environment.publicSiteUrl || '').replace(/\/$/, '');
    if (base.startsWith('http')) {
      const paths: Record<typeof which, string> = {
        sdk: '/integrations/sdk',
        openclaw: '/integrations/openclaw',
        server: '/integrations/server-sidecar',
        events: '/integrations/events',
      };
      window.open(`${base}${paths[which]}`, '_blank', 'noopener');
    }
    this.step = 2;
  }

  backToStep1(): void {
    this.step = 1;
  }

  skipToProviderConfig(): void {
    this.step = 2;
  }

  private async load() {
    const cfg = await this.desktop.getConfig();
    if (cfg) {
      if (typeof cfg['provider'] === 'string') this.provider = cfg['provider'] as string;
      if (typeof cfg['runMode'] === 'string') this.runMode = cfg['runMode'] as string;
      if (typeof cfg['telemetryMode'] === 'string') this.telemetryMode = cfg['telemetryMode'] as string;
      if (typeof cfg['promptSnapshots'] === 'string') this.promptSnapshots = cfg['promptSnapshots'] as string;
      const keys = cfg['providerKeys'] as Record<string, string> | undefined;
      const k = keys?.[this.provider];
      if (k) this.apiKey = k;
    }
  }

  async save() {
    this.error = '';
    this.saving = true;
    try {
      await this.desktop.saveConfig({
        provider: this.provider,
        runMode: this.runMode,
        telemetryMode: this.telemetryMode,
        promptSnapshots: this.promptSnapshots,
      });
      if (this.apiKey.trim()) {
        await this.desktop.setProviderKey(this.provider, this.apiKey.trim());
      }
      localStorage.setItem('spectyra_desktop_onboarding_done', '1');
      await this.router.navigateByUrl('/desktop/dashboard');
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : 'Save failed';
    } finally {
      this.saving = false;
    }
  }
}
