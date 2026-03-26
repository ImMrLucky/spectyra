import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { DesktopBridgeService } from '../../core/desktop/desktop-bridge.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-desktop-openclaw',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  template: `
    <div class="wrap">
      <h1>Use with OpenClaw</h1>
      <p class="sub">
        Point OpenClaw at your Local Companion using <code>models.providers</code> and this base URL:
        <code>{{ baseV1 }}</code>
      </p>

      <mat-card class="card">
        <mat-card-title>Status</mat-card-title>
        <mat-card-content>
          <p><strong>Companion:</strong> {{ health?.['status'] || 'offline' }}</p>
          <p><strong>Aliases:</strong> <code>spectyra/smart</code>, <code>spectyra/fast</code> — routing profiles to your chosen provider in Spectyra, not separate vendors.</p>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-raised-button color="primary" (click)="test()">Test connection</button>
          <button mat-button (click)="copy()">Copy config JSON</button>
        </mat-card-actions>
      </mat-card>

      <mat-card class="card">
        <mat-card-title>Example config</mat-card-title>
        <mat-card-content>
          <pre class="pre">{{ json }}</pre>
        </mat-card-content>
      </mat-card>

      <mat-card class="card">
        <mat-card-title>Troubleshooting</mat-card-title>
        <mat-card-content>
          <ul class="list">
            <li>Ensure the Spectyra app is running and the companion process started.</li>
            <li>Match your provider API key to the upstream provider in Settings / onboarding.</li>
            <li>Run <code>openclaw models list</code> and confirm <code>spectyra/smart</code> appears.</li>
          </ul>
        </mat-card-content>
      </mat-card>

      <p class="msg" *ngIf="message">{{ message }}</p>
    </div>
  `,
  styles: [
    `
      .wrap { max-width: 800px; margin: 0 auto; padding: 24px; }
      h1 { margin: 0 0 8px; }
      .sub { line-height: 1.6; color: #555; margin-bottom: 16px; }
      .sub code { background: #f5f5f5; padding: 2px 6px; }
      .card { margin-bottom: 16px; }
      .pre {
        background: #1e1e1e;
        color: #e0e0e0;
        padding: 12px;
        border-radius: 8px;
        overflow: auto;
        font-size: 12px;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .list { line-height: 1.6; }
      .msg { color: #1565c0; }
    `,
  ],
})
export class DesktopOpenClawPage implements OnInit {
  baseV1 = `${environment.companionBaseUrl}/v1`;
  json = '';
  health: Record<string, unknown> | null = null;
  message = '';

  constructor(private desktop: DesktopBridgeService) {}

  async ngOnInit() {
    this.json = (await this.desktop.openClawExample()) || '';
    await this.refreshHealth();
  }

  async refreshHealth() {
    try {
      const h = await fetch(`${environment.companionBaseUrl}/health`).then((r) => (r.ok ? r.json() : null));
      this.health = h;
    } catch {
      this.health = null;
    }
  }

  async test() {
    this.message = '';
    await this.refreshHealth();
    try {
      const m = await fetch(`${environment.companionBaseUrl}/v1/models`).then((r) => (r.ok ? r.json() : null));
      const ids = (m?.data || []).map((x: { id: string }) => x.id).join(', ');
      this.message = ids ? `OK — models: ${ids}` : 'Reached companion but no models list.';
    } catch {
      this.message = 'Could not reach /v1/models.';
    }
  }

  async copy() {
    if (!this.json) this.json = (await this.desktop.openClawExample()) || '';
    await navigator.clipboard.writeText(this.json);
    this.message = 'Config copied to clipboard.';
  }
}
