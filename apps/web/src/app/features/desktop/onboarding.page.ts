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
    <div class="wrap">
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
              <mat-option value="off">Off — pass-through</mat-option>
              <mat-option value="observe">Observe — projected savings, no provider change in observe</mat-option>
              <mat-option value="on">On — optimize then call provider</mat-option>
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
      .wrap { max-width: 560px; margin: 0 auto; padding: 24px; }
      h1 { margin: 0 0 8px; }
      .sub { color: #666; margin-bottom: 16px; }
      .card { margin-bottom: 16px; }
      .full { width: 100%; display: block; margin-bottom: 8px; }
      .notice { font-size: 13px; color: #555; margin: 16px 0; line-height: 1.5; }
      .err { color: #b00020; }
    `,
  ],
})
export class DesktopOnboardingPage implements OnInit {
  provider = 'openai';
  apiKey = '';
  runMode = 'observe';
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
