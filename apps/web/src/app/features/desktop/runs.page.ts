import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../environments/environment';
import { interval, Subscription } from 'rxjs';

interface RunRow {
  runId?: string;
  mode?: string;
  provider?: string;
  model?: string;
  inputTokensBefore?: number;
  inputTokensAfter?: number;
  estimatedSavings?: number;
  transformsApplied?: string[];
  createdAt?: string;
}

@Component({
  selector: 'app-desktop-runs',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="page">
      <header class="page-header">
        <h1 class="page-title">Runs</h1>
        <p class="page-sub">Individual optimization runs from the Local Companion.</p>
      </header>

      <div class="error-card" *ngIf="error">{{ error }}</div>

      <div class="table-card" *ngIf="!error">
        <table class="dt-table" *ngIf="runs.length">
          <thead>
            <tr>
              <th>Model</th>
              <th>Mode</th>
              <th>Tokens</th>
              <th>Saved</th>
              <th>Reduction</th>
              <th>Est. $</th>
              <th>Transforms</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let r of runs">
              <td>{{ r.provider }}/{{ r.model }}</td>
              <td>
                <span
                  class="mode-chip"
                  [class.on]="r.mode === 'on' || r.mode === 'observe'"
                  [class.off]="r.mode === 'off'"
                >
                  {{ r.mode === 'observe' ? 'on' : r.mode }}
                </span>
              </td>
              <td class="mono">{{ r.inputTokensBefore | number }} → {{ r.inputTokensAfter | number }}</td>
              <td class="mono teal">{{ savedTokens(r) | number }}</td>
              <td class="mono">{{ pct(r) | number: '1.0-1' }}%</td>
              <td class="mono teal">\${{ (r.estimatedSavings ?? 0) | number: '1.2-4' }}</td>
              <td>
                <span class="transform-chip" *ngFor="let t of (r.transformsApplied || []).slice(0, 3)">{{ t }}</span>
              </td>
              <td class="mono muted">{{ r.createdAt | date: 'shortTime' }}</td>
            </tr>
          </tbody>
        </table>

        <div class="empty-state" *ngIf="!runs.length">
          <p>No runs yet. Send traffic through the companion to see activity.</p>
        </div>

        <div class="table-footer">
          <button class="btn-secondary" (click)="refresh()">Refresh</button>
          <span class="run-count" *ngIf="runs.length">{{ runs.length }} runs loaded</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 1100px;
        margin: 0 auto;
        padding: 24px 20px 48px;
        font-family: var(--font-body);
      }

      .page-header { margin-bottom: 20px; }

      .page-title {
        margin: 0 0 6px;
        font-family: var(--font-display);
        font-size: 1.3rem;
        font-weight: 700;
        color: var(--text-primary);
      }

      .page-sub { color: var(--text-secondary); font-size: 13px; margin: 0; }

      .error-card {
        padding: 12px 16px;
        background: var(--color-danger-bg);
        border: 1px solid var(--color-danger-border);
        border-radius: var(--radius-input);
        color: var(--color-danger);
        font-size: 13px;
        margin-bottom: 16px;
      }

      .table-card {
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-radius: var(--radius-card);
        overflow: hidden;
      }

      .dt-table {
        width: 100%;
        border-collapse: collapse;
      }

      .dt-table th {
        text-align: left;
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--text-muted);
        padding: 10px 10px;
        background: var(--bg-elevated);
        border-bottom: 1px solid var(--border);
      }

      .dt-table td {
        font-size: 12px;
        color: var(--text-primary);
        padding: 8px 10px;
        border-bottom: 1px solid var(--border);
      }

      .dt-table tr:hover td {
        background: var(--bg-elevated);
      }

      .mono { font-family: var(--font-mono); }
      .teal { color: #5DCAA5; }
      .muted { color: var(--text-muted); font-size: 11px; }

      .mode-chip {
        font-family: var(--font-mono);
        font-size: 10px;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 3px;
        background: rgba(55, 138, 221, 0.06);
        color: var(--text-secondary);
      }

      .mode-chip.on {
        background: var(--spectyra-teal-pale);
        color: var(--spectyra-teal);
      }

      .mode-chip.off {
        background: var(--spectyra-amber-pale);
        color: var(--spectyra-amber-light);
      }

      .transform-chip {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 3px;
        background: rgba(55, 138, 221, 0.08);
        color: var(--spectyra-blue);
        margin-right: 3px;
      }

      .empty-state {
        padding: 24px 16px;
        text-align: center;

        p {
          margin: 0;
          color: var(--text-muted);
          font-size: 13px;
        }
      }

      .table-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 14px;
        border-top: 1px solid var(--border);
      }

      .run-count {
        font-size: 11px;
        color: var(--text-muted);
      }

      .btn-secondary {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-bright);
        border-radius: 4px;
        font-family: var(--font-body);
        font-size: 11px;
        cursor: pointer;

        &:hover { border-color: var(--spectyra-blue); color: var(--text-primary); }
      }
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
