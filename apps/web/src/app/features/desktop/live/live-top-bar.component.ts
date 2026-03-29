import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { LiveProductTopline } from '../../../core/agent-companion/trial-license-ui.service';
import type { SessionAnalyticsRecord } from '@spectyra/analytics-core';

const SOURCE_LABELS: Record<string, string> = {
  'sdk-wrapper': 'SDK',
  'local-companion': 'Companion',
  'openclaw-jsonl': 'OpenClaw',
  'claude-hooks': 'Claude',
  'claude-jsonl': 'Claude',
  'openai-tracing': 'OpenAI',
  'generic-jsonl': 'Generic',
  'observe-preview': 'Observe',
  unknown: 'Unknown',
};

@Component({
  selector: 'app-live-top-bar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tb-chips-row">
      <div class="tb-left">
        <span class="tb-live-dot"></span>
        <span class="tb-live-label">Live</span>

        <span class="tb-chip trial" *ngIf="topline.trialBadge === 'Trial Active'">TRIAL</span>
        <span class="tb-chip trial-ended" *ngIf="topline.trialBadge === 'Trial Ended'">TRIAL ENDED</span>
        <span class="tb-chip opt">{{ topline.optimizationHeadline | uppercase }}</span>
        <span class="tb-chip model" *ngIf="session?.model">{{ session!.model! | uppercase }}</span>
        <span class="tb-chip sdk" *ngIf="session">{{ sourceLabel(session!) | uppercase }}</span>
      </div>
      <div class="tb-right" *ngIf="session as s">
        <span class="tb-savings-label">Actual savings:</span>
        <span class="tb-savings-val">\${{ s.estimatedWorkflowSavings | number : '1.2-4' }}</span>
      </div>
    </div>
  `,
  styles: [
    `
      .tb-chips-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 0 16px;
        height: 34px;
        background: var(--bg-panel);
      }

      .tb-left {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tb-live-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #1D9E75;
        animation: pulse 2s ease-in-out infinite;
      }

      .tb-live-label {
        font-family: var(--font-body);
        font-size: 12px;
        font-weight: 500;
        color: var(--spectyra-blue-pale);
        margin-right: 4px;
      }

      .tb-chip {
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 2px 8px;
        border-radius: 4px;
      }

      .tb-chip.trial {
        background: var(--spectyra-amber-pale);
        border: 1px solid var(--spectyra-amber-border);
        color: var(--spectyra-amber-light);
      }

      .tb-chip.trial-ended {
        background: rgba(186, 117, 23, 0.15);
        border: 1px solid var(--spectyra-amber-border);
        color: var(--spectyra-amber);
      }

      .tb-chip.opt {
        background: var(--spectyra-teal-pale);
        border: 1px solid var(--spectyra-teal-border);
        color: var(--spectyra-teal);
      }

      .tb-chip.model {
        background: rgba(55, 138, 221, 0.1);
        border: 1px solid rgba(55, 138, 221, 0.25);
        color: var(--spectyra-blue);
      }

      .tb-chip.sdk {
        background: #EEEDFE;
        border: 1px solid rgba(93, 79, 207, 0.3);
        color: #5D4FCF;
      }

      .tb-right {
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .tb-savings-label {
        font-family: var(--font-mono);
        font-size: 11px;
        color: var(--text-muted);
      }

      .tb-savings-val {
        font-family: var(--font-mono);
        font-size: 13px;
        font-weight: 500;
        color: #5DCAA5;
      }

      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
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
