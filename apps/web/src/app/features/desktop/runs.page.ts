import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../../../environments/environment';
import { interval, Subscription } from 'rxjs';

interface RunRow {
  runId?: string;
  mode?: string;
  provider?: string;
  model?: string;
  inputTokensBefore?: number;
  inputTokensAfter?: number;
  createdAt?: string;
}

@Component({
  selector: 'app-desktop-runs',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  template: `
    <div class="wrap">
      <h1>Recent runs</h1>
      <p class="sub">Data from your Local Companion on this machine (<code>{{ base }}</code>).</p>

      <mat-card *ngIf="error" class="card err"><mat-card-content>{{ error }}</mat-card-content></mat-card>

      <mat-card class="card" *ngIf="!error">
        <mat-card-content>
          <div *ngIf="!runs.length" class="empty">No runs yet. Send traffic through the companion (e.g. OpenClaw) to see activity.</div>
          <div class="row" *ngFor="let r of runs">
            <div>
              <strong>{{ r.provider }}/{{ r.model }}</strong>
              <span class="badge" [class.on]="r.mode === 'on'">{{ r.mode }}</span>
              <div class="meta">{{ r.createdAt | date: 'medium' }}</div>
            </div>
            <div class="right">
              <span class="saved" *ngIf="savedTokens(r) > 0">{{ savedTokens(r) | number }} tokens saved</span>
              <div class="meta" *ngIf="r.inputTokensBefore">{{ pct(r) | number: '1.0-1' }}% reduction</div>
            </div>
          </div>
        </mat-card-content>
        <mat-card-actions align="end">
          <button mat-button (click)="refresh()">Refresh</button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .wrap { max-width: 800px; margin: 0 auto; padding: 24px; }
      .sub { color: #666; margin-bottom: 16px; }
      .card.err { border-color: #f8bbd0; }
      .empty { color: #888; padding: 12px 0; }
      .row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 12px 0;
        border-bottom: 1px solid #eee;
      }
      .row:last-child { border-bottom: none; }
      .meta { font-size: 12px; color: #888; margin-top: 4px; }
      .right { text-align: right; }
      .saved { color: #1b5e20; font-weight: 600; }
      .badge {
        margin-left: 8px;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        background: #fff3e0;
        color: #e65100;
      }
      .badge.on { background: #e8f5e9; color: #1b5e20; }
    `,
  ],
})
export class DesktopRunsPage implements OnInit, OnDestroy {
  base = environment.companionBaseUrl;
  runs: RunRow[] = [];
  error: string | null = null;
  private poll?: Subscription;

  ngOnInit() {
    void this.refresh();
    this.poll = interval(12000).subscribe(() => void this.refresh());
  }

  ngOnDestroy() {
    this.poll?.unsubscribe();
  }

  savedTokens(r: RunRow): number {
    const b = r.inputTokensBefore ?? 0;
    const a = r.inputTokensAfter ?? b;
    return Math.max(0, b - a);
  }

  pct(r: RunRow): number {
    const b = r.inputTokensBefore ?? 0;
    if (b <= 0) return 0;
    return (this.savedTokens(r) / b) * 100;
  }

  async refresh() {
    this.error = null;
    try {
      const res = await fetch(`${this.base}/v1/runs?limit=40`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RunRow[];
      this.runs = Array.isArray(data) ? [...data].reverse() : [];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not load runs';
      this.runs = [];
    }
  }
}
