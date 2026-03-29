import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import type { SessionAnalyticsRecord, StepAnalyticsRecord } from '@spectyra/analytics-core';
import type { WorkflowPolicySummary } from '../../../core/analytics/companion-analytics.service';

@Component({
  selector: 'app-spectyra-intelligence-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="ip">
      <h2 class="ip-title">SPECTYRA INTELLIGENCE</h2>

      <!-- Cost estimate card -->
      <div class="cost-card" [class.flash]="costFlash" *ngIf="session as s">
        <span class="cost-label">Cost estimate</span>
        <div class="cost-row">
          <span class="cost-before">\${{ s.estimatedWorkflowCostBefore | number : '1.2-4' }}</span>
          <span class="cost-arrow">→</span>
          <span class="cost-after">\${{ s.estimatedWorkflowCostAfter | number : '1.2-4' }}</span>
          <span class="cost-badge" [class.actual]="topline.metricsPresentation === 'actual'">
            {{ topline.metricsPresentation === 'actual' ? 'ACTUAL' : 'PROJECTED' }}
          </span>
        </div>
      </div>

      <!-- Metrics 2×2 grid -->
      <div class="metrics-grid" *ngIf="session as s">
        <div class="metric-cell">
          <span class="mc-label">Input tokens</span>
          <span class="mc-value">{{ s.totalInputTokensAfter | number }}</span>
          <span class="mc-badge teal" *ngIf="savingsPct(s) > 0">↓ {{ savingsPct(s) | number:'1.0-0' }}% reduced</span>
        </div>
        <div class="metric-cell">
          <span class="mc-label">Steps</span>
          <span class="mc-value">{{ s.totalSteps }}</span>
          <span class="mc-sub">{{ s.endedAt ? 'completed' : runningSteps() + ' running' }}</span>
        </div>
        <div class="metric-cell">
          <span class="mc-label">Efficiency</span>
          <div class="mc-gauge-row">
            <svg class="gauge" viewBox="0 0 64 64" width="52" height="52">
              <path [attr.d]="arcBg" fill="none" stroke="rgba(55,138,221,0.1)" stroke-width="4"/>
              <path [attr.d]="arcBg" fill="none" stroke="#1D9E75" stroke-width="4"
                    stroke-linecap="round" [attr.stroke-dasharray]="arcDash" [attr.stroke-dashoffset]="arcOffset"/>
              <text x="32" y="36" text-anchor="middle" font-family="'DM Mono', monospace"
                    font-size="12" fill="#e8f1fb">{{ efficiencyScore | number:'1.1-1' }}</text>
            </svg>
            <span class="mc-eff-label" [class.excellent]="efficiencyScore >= 80"
                  [class.good]="efficiencyScore >= 50 && efficiencyScore < 80"
                  [class.low]="efficiencyScore < 50">
              {{ efficiencyScore >= 80 ? 'excellent' : (efficiencyScore >= 50 ? 'good' : 'low') }}
            </span>
          </div>
        </div>
        <div class="metric-cell">
          <span class="mc-label">Latency</span>
          <span class="mc-value">{{ latencyS | number:'1.1-1' }}s</span>
          <span class="mc-sub">sum of steps</span>
        </div>
      </div>

      <!-- Transforms -->
      <div class="transforms-section" *ngIf="session as s">
        <h3 class="section-label">TRANSFORMS APPLIED</h3>
        <div class="transform-chips">
          <span *ngFor="let t of s.transformsApplied; let i = index"
                class="t-chip"
                [class.t-teal]="i % 3 === 0"
                [class.t-blue]="i % 3 === 1"
                [class.t-purple]="i % 3 === 2">
            {{ t }}
          </span>
          <span class="empty-msg" *ngIf="!s.transformsApplied?.length">—</span>
        </div>
      </div>

      <!-- Workflow policy card -->
      <div class="policy-card" *ngIf="workflowPolicy">
        <div class="policy-row">
          <span class="policy-label">Workflow policy</span>
          <span class="policy-mode">{{ workflowPolicy.mode | uppercase }}</span>
        </div>
        <div class="policy-warning" *ngIf="workflowPolicy.shouldBlock">
          <span class="pw-dot"></span>
          <span>{{ workflowPolicy.violations.length ? workflowPolicy.violations[0].message : 'Would be blocked under strict policy' }}</span>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .ip { padding: 0; }

      .ip-title {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin: 0 0 12px;
      }

      /* ── Cost card ── */
      .cost-card {
        background: #121c2e;
        border: 1px solid rgba(29, 158, 117, 0.2);
        border-radius: 8px;
        padding: 14px 16px;
        margin-bottom: 14px;
        transition: background 300ms ease;
      }

      .cost-card.flash {
        background: rgba(29, 158, 117, 0.08);
      }

      .cost-label {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--text-muted);
        display: block;
        margin-bottom: 8px;
      }

      .cost-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
        flex-wrap: wrap;
      }

      .cost-before {
        font-family: var(--font-mono);
        font-size: 13px;
        color: var(--text-secondary);
        text-decoration: line-through;
        text-decoration-color: rgba(122, 159, 192, 0.4);
      }

      .cost-arrow {
        font-size: 12px;
        color: var(--text-muted);
      }

      .cost-after {
        font-family: var(--font-mono);
        font-size: 16px;
        font-weight: 500;
        color: #5DCAA5;
      }

      .cost-badge {
        font-family: var(--font-mono);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 2px 6px;
        border-radius: 3px;
        background: rgba(55, 138, 221, 0.1);
        color: var(--spectyra-blue);
        border: 1px solid rgba(55, 138, 221, 0.2);
      }

      .cost-badge.actual {
        background: var(--spectyra-teal-pale);
        color: var(--spectyra-teal);
        border-color: var(--spectyra-teal-border);
      }

      /* ── Metrics grid ── */
      .metrics-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 16px;
      }

      .metric-cell {
        background: #121c2e;
        border: 1px solid rgba(55, 138, 221, 0.12);
        border-radius: 8px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .mc-label {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--text-muted);
      }

      .mc-value {
        font-family: var(--font-mono);
        font-size: 18px;
        font-weight: 500;
        color: var(--spectyra-blue-pale);
      }

      .mc-badge {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 3px;
        display: inline-block;
        width: fit-content;
      }

      .mc-badge.teal {
        background: var(--spectyra-teal-pale);
        color: var(--spectyra-teal);
      }

      .mc-sub {
        font-family: var(--font-body);
        font-size: 11px;
        color: var(--text-muted);
      }

      .mc-gauge-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 2px;
      }

      .gauge { flex-shrink: 0; }

      .mc-eff-label {
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
      }

      .mc-eff-label.excellent { color: #5DCAA5; }
      .mc-eff-label.good { color: var(--spectyra-blue); }
      .mc-eff-label.low { color: var(--spectyra-amber-light); }

      /* ── Transforms ── */
      .section-label {
        font-family: var(--font-body);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin: 0 0 10px;
      }

      .transforms-section {
        margin-bottom: 16px;
      }

      .transform-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .t-chip {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 3px 8px;
        border-radius: 4px;
      }

      .t-chip.t-teal {
        background: var(--spectyra-teal-pale);
        border: 1px solid var(--spectyra-teal-border);
        color: var(--spectyra-teal);
      }

      .t-chip.t-blue {
        background: rgba(55, 138, 221, 0.1);
        border: 1px solid rgba(55, 138, 221, 0.25);
        color: var(--spectyra-blue);
      }

      .t-chip.t-purple {
        background: #EEEDFE;
        border: 1px solid rgba(93, 79, 207, 0.3);
        color: #5D4FCF;
      }

      .empty-msg {
        color: var(--text-muted);
        font-size: 12px;
      }

      /* ── Policy card ── */
      .policy-card {
        background: #121c2e;
        border: 1px solid rgba(55, 138, 221, 0.12);
        border-radius: 8px;
        padding: 14px 16px;
      }

      .policy-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 4px;
      }

      .policy-label {
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--text-secondary);
      }

      .policy-mode {
        font-family: var(--font-mono);
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 4px;
        background: var(--spectyra-amber-pale);
        border: 1px solid var(--spectyra-amber-border);
        color: var(--spectyra-amber-light);
      }

      .policy-warning {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-top: 10px;
        padding: 10px 12px;
        border-radius: 6px;
        background: var(--spectyra-amber-pale);
        border: 1px solid var(--spectyra-amber-border);
        font-family: var(--font-body);
        font-size: 12px;
        color: var(--spectyra-amber-light);
        line-height: 1.45;
      }

      .pw-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--spectyra-amber-light);
        flex-shrink: 0;
        margin-top: 5px;
      }
    `,
  ],
})
export class SpectyraIntelligencePanelComponent implements OnChanges {
  @Input({ required: true }) topline!: LiveProductTopline;
  @Input() session: SessionAnalyticsRecord | null = null;
  @Input() workflowPolicy: WorkflowPolicySummary | null = null;
  @Input() stepRows: StepAnalyticsRecord[] = [];

  costFlash = false;
  efficiencyScore = 0;
  latencyS = 0;

  arcBg = 'M 8 48 A 28 28 0 1 1 56 48';
  arcDash = '0 132';
  arcOffset = '0';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['session'] || changes['stepRows']) {
      this.computeMetrics();
    }
    if (changes['session'] && !changes['session'].firstChange) {
      this.triggerCostFlash();
    }
  }

  savingsPct(s: SessionAnalyticsRecord): number {
    if (!s.totalInputTokensBefore) return 0;
    return (100 * (s.totalInputTokensBefore - s.totalInputTokensAfter)) / s.totalInputTokensBefore;
  }

  runningSteps(): number {
    return this.stepRows.filter((r: any) => !r.endedAt).length;
  }

  private computeMetrics() {
    const s = this.session;
    if (s) {
      this.efficiencyScore = s.estimatedWorkflowSavingsPct ?? 0;
      this.updateArc(this.efficiencyScore);
    }

    let t = 0;
    for (const r of this.stepRows) {
      if ((r as any).latencyMs != null) t += (r as any).latencyMs;
    }
    this.latencyS = t / 1000;
  }

  private updateArc(pct: number) {
    const totalLen = 132;
    const filled = (Math.min(100, Math.max(0, pct)) / 100) * totalLen;
    this.arcDash = `${filled} ${totalLen}`;
    this.arcOffset = '0';
  }

  private triggerCostFlash() {
    this.costFlash = true;
    setTimeout(() => (this.costFlash = false), 300);
  }
}
