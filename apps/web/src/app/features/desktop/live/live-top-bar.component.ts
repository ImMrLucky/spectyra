import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';

const SOURCE_LABELS: Record<string, string> = {
  'sdk-wrapper': 'SDK App',
  'local-companion': 'Local Companion',
  'openclaw-jsonl': 'OpenClaw',
  'claude-hooks': 'Claude Runtime',
  'claude-jsonl': 'Claude Runtime',
  'openai-tracing': 'OpenAI Agents',
  'generic-jsonl': 'Generic attach',
  'observe-preview': 'Observe preview',
  unknown: 'Unknown',
};

@Component({
  selector: 'app-live-top-bar',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <header class="tb">
      <div class="tb-brand">
        <mat-icon class="tb-icon" fontIcon="bolt"></mat-icon>
        <span class="tb-title">Spectyra</span>
        <span class="tb-pill" [class.on]="health?.['status'] === 'ok'">
          {{ health?.['status'] === 'ok' ? 'Active' : 'Offline' }}
        </span>
      </div>
      <div class="tb-badges">
        <span class="tb-chip trial" *ngIf="topline.trialBadge === 'Trial Active'">Trial Active</span>
        <span class="tb-chip trial-ended" *ngIf="topline.trialBadge === 'Trial Ended'">Trial Ended</span>
        <span class="tb-chip opt">{{ topline.optimizationHeadline }}</span>
        <span class="tb-chip mode">Mode: {{ topline.runMode }}</span>
        <span class="tb-chip metrics" *ngIf="topline.metricsPresentation === 'actual'">Actual savings</span>
        <span class="tb-chip metrics projected" *ngIf="topline.metricsPresentation === 'projected'">Projected savings</span>
      </div>
      <div class="tb-meta" *ngIf="session">
        <span class="tb-muted">{{ session.provider || 'Provider' }} · {{ session.model || '—' }}</span>
        <span class="tb-muted"> · Source: {{ sourceLabel(session) }}</span>
      </div>
    </header>
  `,
  styles: [
    `
      .tb {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px 20px;
        padding: 16px 20px;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.88));
        color: #e2e8f0;
        border: 1px solid rgba(148, 163, 184, 0.15);
      }
      .tb-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tb-icon {
        color: #38bdf8;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
      .tb-title {
        font-weight: 650;
        font-size: 1.1rem;
        letter-spacing: -0.02em;
      }
      .tb-pill {
        font-size: 0.75rem;
        padding: 3px 10px;
        border-radius: 999px;
        background: rgba(239, 68, 68, 0.2);
        color: #fecaca;
      }
      .tb-pill.on {
        background: rgba(34, 197, 94, 0.2);
        color: #bbf7d0;
      }
      .tb-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
      }
      .tb-chip {
        font-size: 0.72rem;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 8px;
        background: rgba(51, 65, 85, 0.9);
        color: #e2e8f0;
      }
      .tb-chip.trial {
        background: rgba(59, 130, 246, 0.25);
        color: #bfdbfe;
      }
      .tb-chip.trial-ended {
        background: rgba(245, 158, 11, 0.2);
        color: #fde68a;
      }
      .tb-chip.opt {
        background: rgba(16, 185, 129, 0.2);
        color: #a7f3d0;
      }
      .tb-chip.projected {
        background: rgba(168, 85, 247, 0.2);
        color: #e9d5ff;
      }
      .tb-meta {
        flex: 1 1 100%;
        font-size: 0.8rem;
      }
      .tb-muted {
        color: #94a3b8;
      }
    `,
  ],
})
export class LiveTopBarComponent {
  @Input({ required: true }) topline!: LiveProductTopline;
  @Input() health: Record<string, unknown> | null = null;
  @Input() session: SessionAnalyticsRecord | null = null;

  sourceLabel(s: SessionAnalyticsRecord): string {
    const k = s.integrationType ?? 'unknown';
    return SOURCE_LABELS[k] ?? k;
  }
}
