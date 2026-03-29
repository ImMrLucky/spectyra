import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';
import type { WorkflowPolicySummary } from '../../../core/analytics/companion-analytics.service';

@Component({
  selector: 'app-spectyra-intelligence-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <section class="panel">
      <h2 class="panel-title">
        <mat-icon fontIcon="auto_graph"></mat-icon>
        Spectyra intelligence
      </h2>
      <p class="panel-sub">Optimization, savings, and efficiency — separate from raw agent traffic.</p>

      <div class="banner" *ngIf="topline.metricsPresentation === 'projected'">
        <mat-icon fontIcon="visibility"></mat-icon>
        <span>{{ topline.trustLine }}</span>
      </div>

      <div class="metrics" *ngIf="session as s">
        <div class="metric">
          <span class="mlab">
            Cost (est.)
            <span class="actual" *ngIf="topline.metricsPresentation === 'actual'">Actual</span>
            <span class="proj" *ngIf="topline.metricsPresentation === 'projected'">Projected</span>
          </span>
          <span class="mval">
            \${{ s.estimatedWorkflowCostBefore | number : '1.2-4' }} → \${{ s.estimatedWorkflowCostAfter | number : '1.2-4' }}
          </span>
        </div>
        <div class="metric">
          <span class="mlab">Tokens (input)</span>
          <span class="mval">
            {{ s.totalInputTokensBefore | number }} → {{ s.totalInputTokensAfter | number }}
            <span class="delta">({{ savingsPct(s) | number : '1.0-0' }}%)</span>
          </span>
        </div>
        <div class="metric">
          <span class="mlab">Steps</span>
          <span class="mval">{{ s.totalSteps }}</span>
        </div>
        <div class="metric">
          <span class="mlab">Efficiency</span>
          <span class="mval">{{ s.estimatedWorkflowSavingsPct | number : '1.1-1' }}% savings</span>
        </div>
        <div class="metric" *ngIf="timeSavedMs() as ms">
          <span class="mlab">Time (step latency sum)</span>
          <span class="mval">{{ (ms / 1000) | number : '1.1-1' }}s</span>
        </div>
      </div>

      <div class="card" *ngIf="session as s2">
        <h3 class="h3">Transforms</h3>
        <div class="chips">
          <span class="chip" *ngFor="let t of s2.transformsApplied">{{ t }}</span>
          <span class="muted" *ngIf="!s2.transformsApplied?.length">—</span>
        </div>
        <p class="fine">
          <strong>Repeated context avoided:</strong> {{ s2.repeatedContextTokensAvoided | number }} tokens
        </p>
      </div>

      <div class="card policy" *ngIf="workflowPolicy">
        <h3 class="h3">Workflow policy</h3>
        <p class="fine">
          Mode <span class="mono">{{ workflowPolicy.mode }}</span>
          <span *ngIf="workflowPolicy.shouldBlock" class="warn"> — would block in enforce</span>
        </p>
      </div>
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
        margin: 0 0 14px;
        font-size: 0.85rem;
        color: #64748b;
        line-height: 1.5;
      }
      .banner {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 10px 12px;
        border-radius: 10px;
        background: #f5f3ff;
        border: 1px solid #ddd6fe;
        color: #5b21b6;
        font-size: 0.82rem;
        line-height: 1.45;
        margin-bottom: 14px;
      }
      .metrics {
        display: grid;
        gap: 10px;
        margin-bottom: 14px;
      }
      .metric {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 10px 12px;
        border-radius: 10px;
        background: linear-gradient(180deg, #ffffff, #f8fafc);
        border: 1px solid #e2e8f0;
      }
      .mlab {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .actual {
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: #dcfce7;
        color: #166534;
      }
      .proj {
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: 4px;
        background: #ede9fe;
        color: #5b21b6;
      }
      .mval {
        font-size: 1rem;
        font-weight: 650;
        color: #0f172a;
      }
      .delta {
        font-weight: 500;
        color: #059669;
        font-size: 0.85rem;
      }
      .card {
        border-radius: 10px;
        padding: 12px 14px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        margin-bottom: 10px;
      }
      .h3 {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
        margin: 0 0 8px;
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .chip {
        font-size: 0.75rem;
        padding: 3px 8px;
        border-radius: 6px;
        background: #e0f2fe;
        color: #0369a1;
      }
      .fine {
        margin: 8px 0 0;
        font-size: 0.82rem;
        color: #475569;
      }
      .policy .fine {
        margin: 0;
      }
      .mono {
        font-family: ui-monospace, monospace;
      }
      .warn {
        color: #b45309;
      }
      .muted {
        color: #94a3b8;
      }
    `,
  ],
})
export class SpectyraIntelligencePanelComponent {
  @Input({ required: true }) topline!: LiveProductTopline;
  @Input() session: SessionAnalyticsRecord | null = null;
  @Input() workflowPolicy: WorkflowPolicySummary | null = null;
  /** Sum of step latencies when present (ms). */
  @Input() stepRows: { latencyMs?: number }[] = [];

  savingsPct(s: SessionAnalyticsRecord): number {
    if (!s.totalInputTokensBefore) return 0;
    return (100 * (s.totalInputTokensBefore - s.totalInputTokensAfter)) / s.totalInputTokensBefore;
  }

  timeSavedMs(): number | null {
    let t = 0;
    let n = 0;
    for (const r of this.stepRows) {
      if (r.latencyMs != null) {
        t += r.latencyMs;
        n++;
      }
    }
    return n ? t : null;
  }
}
