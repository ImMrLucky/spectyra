import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DesktopBridgeService } from '../../core/desktop/desktop-bridge.service';
import { environment } from '../../../environments/environment';
import { interval, Subscription } from 'rxjs';

@Component({
  selector: 'app-desktop-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="wrap">
      <h1>Dashboard</h1>
      <p class="sub">Local Companion runs on <code>{{ companionHost }}</code></p>

      <mat-card class="card">
        <mat-card-title>Connection</mat-card-title>
        <mat-card-content>
          <p><strong>Status:</strong> {{ health?.['status'] || 'unknown' }}</p>
          <p><strong>Run mode:</strong> {{ health?.['runMode'] || '—' }}</p>
          <p><strong>Inference:</strong> {{ health?.['inferencePath'] || 'direct_provider' }}</p>
          <p><strong>Telemetry:</strong> {{ health?.['telemetryMode'] || 'local' }}</p>
        </mat-card-content>
        <mat-card-actions>
          <button mat-raised-button color="primary" (click)="refresh()">Refresh</button>
          <a mat-button routerLink="/desktop/openclaw">OpenClaw setup</a>
        </mat-card-actions>
      </mat-card>

      <mat-card class="card" *ngIf="currentSession">
        <mat-card-title>Current session (live)</mat-card-title>
        <mat-card-content>
          <p><strong>Steps:</strong> {{ currentSession['totalSteps'] ?? '—' }}</p>
          <p><strong>Token savings (input):</strong>
            {{ (currentSession['totalInputTokensBefore'] ?? 0) - (currentSession['totalInputTokensAfter'] ?? 0) }}</p>
          <p><strong>Workflow savings (est. USD):</strong> {{ currentSession['estimatedWorkflowSavings'] | number:'1.2-4' }}</p>
          <p><strong>Mode:</strong> {{ currentSession['mode'] }}</p>
          <p class="fine">Inference: direct to provider · Telemetry: {{ currentSession['security']?.['telemetryMode'] }}</p>
        </mat-card-content>
      </mat-card>

      <mat-card class="card">
        <mat-card-title>Security</mat-card-title>
        <mat-card-content>
          <ul class="list">
            <li>Provider billing stays on your provider account.</li>
            <li>Spectyra does not proxy live inference through Spectyra servers by default.</li>
            <li>Prompts and responses stay on this machine by default.</li>
          </ul>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
      h1 { margin: 0 0 8px; font-size: 1.75rem; }
      .sub { color: #666; margin-bottom: 20px; }
      .card { margin-bottom: 16px; }
      .list { margin: 0; padding-left: 1.2rem; line-height: 1.6; }
      code { background: #f0f0f0; padding: 2px 6px; border-radius: 4px; }
      .fine { font-size: 0.85rem; color: #666; margin-bottom: 0; }
    `,
  ],
})
export class DesktopDashboardPage implements OnInit, OnDestroy {
  companionHost = environment.companionBaseUrl;
  health: Record<string, unknown> | null = null;
  currentSession: Record<string, unknown> | null = null;
  private poll?: Subscription;

  constructor(private desktop: DesktopBridgeService) {}

  ngOnInit() {
    void this.refresh();
    this.poll = interval(8000).subscribe(() => void this.refresh());
  }

  ngOnDestroy() {
    this.poll?.unsubscribe();
  }

  async refresh() {
    try {
      const h = await fetch(`${this.companionHost}/health`).then((r) => (r.ok ? r.json() : null));
      this.health = h;
    } catch {
      this.health = null;
    }
    try {
      const s = await fetch(`${this.companionHost}/v1/analytics/current-session`).then((r) =>
        r.ok ? r.json() : null,
      );
      this.currentSession = s && typeof s === 'object' && s !== null && 'sessionId' in s ? s : null;
    } catch {
      this.currentSession = null;
    }
  }
}
