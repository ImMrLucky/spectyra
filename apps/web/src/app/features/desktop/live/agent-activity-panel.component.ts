import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { SessionAnalyticsRecord, StepAnalyticsRecord } from '@spectyra/analytics-core';

@Component({
  selector: 'app-agent-activity-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="ap">
      <h2 class="ap-title">AGENT ACTIVITY</h2>

      <!-- Session header card -->
      <div class="session-card" *ngIf="session as s">
        <div class="session-top">
          <div class="session-id-block">
            <span class="session-label">Session</span>
            <span class="session-id">{{ s.sessionId | slice : 0 : 8 }}…</span>
          </div>
          <div class="session-badges">
            <span class="step-badge">{{ s.totalSteps }} steps</span>
            <span class="status-badge" [class.running]="!s.endedAt">
              <span class="status-dot" *ngIf="!s.endedAt"></span>
              {{ s.endedAt ? 'completed' : 'running' }}
            </span>
          </div>
        </div>
      </div>
      <div class="session-card empty" *ngIf="!session">
        <p>No active session. Point your SDK at the Local Companion and send a request.</p>
      </div>

      <!-- Live step feed -->
      <h3 class="section-label">LIVE STEP FEED</h3>
      <div class="feed-scroll" *ngIf="stepRows.length">
        <div class="feed-row" *ngFor="let row of stepRows.slice(0, 12); let i = index"
             [style.animation-delay]="(i * 30) + 'ms'">
          <span class="feed-idx">{{ (row.stepIndex ?? 0) + 1 | number:'2.0-0' }}</span>
          <span class="feed-model">{{ row.model || '—' }}</span>
          <span class="feed-tokens">
            <span class="tok-before">{{ row.inputTokensBefore | number }}</span>
            <span class="tok-arrow">→</span>
            <span class="tok-after">{{ row.inputTokensAfter | number }}</span>
          </span>
        </div>
      </div>
      <p class="empty-msg" *ngIf="!stepRows.length">Waiting for steps…</p>

      <!-- Event timeline -->
      <h3 class="section-label">EVENT TIMELINE</h3>
      <div class="timeline" *ngIf="recentEvents.length">
        <div class="tl-row" *ngFor="let e of recentEvents.slice(0, 14)">
          <span class="tl-time">{{ e.timestamp | slice : 11 : 19 }}</span>
          <span class="tl-chip"
                [class.tl-opt]="e.type === 'optimization_applied'"
                [class.tl-prov]="e.type === 'provider_request_completed'"
                [class.tl-policy]="e.type === 'workflow_policy_evaluated'">
            {{ formatEventType(e.type) }}
          </span>
        </div>
      </div>
      <p class="empty-msg" *ngIf="!recentEvents.length">No events yet.</p>
    </section>
  `,
  styles: [
    `
      .ap { padding: 0; }

      .ap-title {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin: 0 0 12px;
      }

      /* ── Session card ── */
      .session-card {
        background: #121c2e;
        border: 1px solid rgba(55, 138, 221, 0.12);
        border-radius: 8px;
        padding: 14px 16px;
        margin-bottom: 20px;
      }

      .session-card.empty {
        color: var(--text-muted);
        font-family: var(--font-body);
        font-size: 12px;

        p { margin: 0; line-height: 1.5; }
      }

      .session-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .session-id-block {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .session-label {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--text-muted);
      }

      .session-id {
        font-family: var(--font-mono);
        font-size: 12px;
        color: #85B7EB;
      }

      .session-badges {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .step-badge {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 4px;
        background: rgba(55, 138, 221, 0.1);
        color: #85B7EB;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 4px;
        background: rgba(55, 138, 221, 0.06);
        color: var(--text-secondary);
      }

      .status-badge.running {
        background: var(--spectyra-teal-pale);
        color: var(--spectyra-teal);
      }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #1D9E75;
        animation: pulse 2s ease-in-out infinite;
      }

      /* ── Section labels ── */
      .section-label {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin: 0 0 10px;
      }

      /* ── Step feed ── */
      .feed-scroll {
        margin-bottom: 20px;
        max-height: 340px;
        overflow-y: auto;

        &::-webkit-scrollbar { width: 3px; }
        &::-webkit-scrollbar-thumb { background: rgba(55, 138, 221, 0.2); border-radius: 3px; }
      }

      .feed-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 0;
        border-bottom: 1px solid rgba(55, 138, 221, 0.08);
        animation: feedSlideIn 200ms ease-out both;
      }

      .feed-idx {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-muted);
        min-width: 24px;
      }

      .feed-model {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--text-secondary);
        flex: 1;
      }

      .feed-tokens {
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: var(--font-mono);
        font-size: 12px;
      }

      .tok-before { color: var(--text-secondary); }
      .tok-arrow { color: var(--text-muted); font-size: 11px; }
      .tok-after { color: #5DCAA5; }

      /* ── Event timeline ── */
      .timeline {
        border-left: 1px solid rgba(55, 138, 221, 0.12);
        padding-left: 12px;
        margin-bottom: 16px;
      }

      .tl-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 0;
      }

      .tl-time {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--text-muted);
        min-width: 54px;
      }

      .tl-chip {
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 500;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        background: rgba(55, 138, 221, 0.08);
        color: #85B7EB;
      }

      .tl-chip.tl-opt {
        background: var(--spectyra-teal-pale);
        color: var(--spectyra-teal);
      }

      .tl-chip.tl-prov {
        background: rgba(55, 138, 221, 0.1);
        color: var(--spectyra-blue);
      }

      .tl-chip.tl-policy {
        background: var(--spectyra-amber-pale);
        color: var(--spectyra-amber-light);
      }

      .empty-msg {
        color: var(--text-muted);
        font-family: var(--font-body);
        font-size: 12px;
        margin: 0 0 20px;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }

      @keyframes feedSlideIn {
        from { transform: translateY(8px); opacity: 0; }
        to   { transform: translateY(0);   opacity: 1; }
      }
    `,
  ],
})
export class AgentActivityPanelComponent {
  @Input() session: SessionAnalyticsRecord | null = null;
  @Input() stepRows: StepAnalyticsRecord[] = [];
  @Input() recentEvents: Array<{ type: string; timestamp: string; sessionId: string }> = [];

  formatEventType(t: string): string {
    return t.replace(/_/g, '_');
  }
}
