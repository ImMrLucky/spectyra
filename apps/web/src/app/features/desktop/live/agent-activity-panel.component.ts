import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { SessionAnalyticsRecord, StepAnalyticsRecord } from '@spectyra/analytics-core';

@Component({
  selector: 'app-agent-activity-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <section class="panel">
      <h2 class="panel-title">
        <mat-icon fontIcon="smart_toy"></mat-icon>
        Agent activity
      </h2>
      <p class="panel-sub">What your runtime is doing — steps, provider calls, and tool traffic (from normalized events).</p>

      <div class="card" *ngIf="session as s">
        <div class="row">
          <span class="k">Session</span>
          <span class="v mono">{{ s.sessionId | slice : 0 : 12 }}…</span>
        </div>
        <div class="row">
          <span class="k">Steps</span>
          <span class="v">{{ s.totalSteps }}</span>
        </div>
        <div class="row">
          <span class="k">Status</span>
          <span class="v">{{ s.endedAt ? 'completed' : 'running' }}</span>
        </div>
      </div>
      <div class="card empty" *ngIf="!session">
        <p>No active session yet. Point OpenClaw or your SDK at the Local Companion and send a request.</p>
      </div>

      <h3 class="h3">Live step feed</h3>
      <ul class="feed" *ngIf="stepRows.length">
        <li *ngFor="let row of stepRows.slice(0, 12)">
          <span class="mono">#{{ (row.stepIndex ?? 0) + 1 }}</span>
          <span>{{ row.model || '—' }}</span>
          <span class="muted">{{ row.inputTokensBefore | number }} → {{ row.inputTokensAfter | number }} tok</span>
        </li>
      </ul>
      <p class="muted" *ngIf="!stepRows.length">Waiting for steps…</p>

      <h3 class="h3">Event timeline</h3>
      <ul class="feed small">
        <li *ngFor="let e of recentEvents.slice(0, 14)">
          <span class="mono">{{ e.timestamp | slice : 11 : 19 }}</span>
          <span class="tag">{{ e.type }}</span>
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      .panel {
        padding: 4px 4px 20px;
      }
      .panel-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 6px;
        font-size: 1.05rem;
        font-weight: 650;
        color: #0f172a;
      }
      .panel-sub {
        margin: 0 0 16px;
        font-size: 0.85rem;
        color: #64748b;
        line-height: 1.5;
      }
      .card {
        border-radius: 10px;
        padding: 12px 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        margin-bottom: 16px;
      }
      .card.empty {
        color: #64748b;
        font-size: 0.9rem;
      }
      .row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 0.85rem;
        margin-bottom: 6px;
      }
      .row:last-child {
        margin-bottom: 0;
      }
      .k {
        color: #64748b;
      }
      .v {
        font-weight: 600;
        color: #0f172a;
      }
      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 0.8rem;
      }
      .h3 {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
        margin: 16px 0 8px;
      }
      .feed {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      .feed li {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 12px;
        padding: 8px 0;
        border-bottom: 1px solid #f1f5f9;
        font-size: 0.85rem;
      }
      .feed.small li {
        font-size: 0.78rem;
      }
      .muted {
        color: #94a3b8;
      }
      .tag {
        background: #eef2ff;
        color: #4338ca;
        padding: 2px 8px;
        border-radius: 6px;
        font-weight: 500;
      }
    `,
  ],
})
export class AgentActivityPanelComponent {
  @Input() session: SessionAnalyticsRecord | null = null;
  @Input() stepRows: StepAnalyticsRecord[] = [];
  @Input() recentEvents: Array<{ type: string; timestamp: string; sessionId: string }> = [];
}
